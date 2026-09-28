# PRD — Subscription Monitoring & Renewal System

> Status: approvals (procurement + renewal routes) implemented — live progress in
> `docs/approval-flows-implementation-plan.md` §0.
> Stack: Laravel 12 + PHP 8.2 + Inertia 3 + React 19 + Tailwind 4/shadcn.
> Revised: 2026-09-24 (originally drafted 2026-09-19).

> **Read §0 before anything else.** It defines who operates this system and what
> the offices in the approval route actually are. Every other section assumes it.

## 0. Scope & Operating Model — READ FIRST

**This system is operated by the ICT department only.** It tracks **the ICT
department's own subscriptions** — not the whole organization's — and the
movement of the papers those subscriptions require.

| Concept | Meaning |
| --- | --- |
| System users | **ICT department staff only.** No other office has an account, and none will be added. |
| `Office` | A **reference list of waypoint offices** (Budget, Accounting, Head, …) used to describe where papers physically travel. An office is a *destination*, not a participant. |
| Approval request / route | ICT's **log of the physical route** the papers take — not a multi-user approval workflow. |
| `current_office_id` | "The papers are currently with this office." A physical location for ICT's tracking — **not** an access boundary. |
| **Received by** | The **contact person at that office who received the papers**, recorded by ICT, so a pending step already names who to follow up with. |
| **Approved by** | The person who approved the papers, **usually the office head**. Recorded by ICT; approval is what permits forwarding to the next office. |
| `acted_by` (FK → `users`) | The **ICT staff account that encoded the entry** — never the officer who approved. |

Explicitly **out of scope** — do not build:

- Logins, portals, or accounts for other offices.
- Per-office authorization, office-scoped queues, or "my office" permissions:
  there is no office-level access boundary to enforce.
- Receipt confirmation by other offices. ICT records every step of the route.
- Notifications/email to other offices — they are not users.

Rules that follow from the above:

- **Never derive `Received by` / `Approved by` from the logged-in user's name.**
  That would credit the ICT encoder for an approval somebody else made. Both are
  always typed values.
- `Subscription.office_id` / `owner_id` are ICT's own bookkeeping; they do not
  grant anyone access.

> Consequence: `docs/approval-flows-implementation-plan.md` §11.1 (office-scoped
> authorization) and §12.4 (`users.office_id` + "my office" queue) are **not
> required by design** and should not be built.

## 1. Overview

ICT's internal register of the subscriptions the department pays for (provider,
cost, billing interval, start/renewal dates, status), plus the renewal review
workflow (renewed / cancelled / pending with cost and date changes) and the
tracking of where renewal and procurement papers sit on their route through the
offices (§0).

Every change is audited (`audit_logs`, written through `App\Services\AuditTrail`)
and logins are recorded (`login_activities`). The `activity_logs` table exists
but is empty and unused.

Core loop: `login → dashboard shows what is due → search/filter subscriptions →
create/edit/cancel → record a renewal decision → follow the papers through the
route → see history and audit trail`.

## 2. Goals / Non-goals

Goals (MVP):

- Know what renews soon, what is overdue, and the department's active spend.
- Record renewal decisions with before/after cost and dates.
- Trace where the papers are on their route (`----0-----0------0----0`),
  naming **who received** them at each office and **who approved** them.
- Manage offices (orderable, deactivatable without code changes) and the
  approval flows that describe the route.
- Full audit trail of every recorded action.

Non-goals (explicitly out of MVP):

- No accounts, logins, or portals for other offices; no per-office
  authorization and no office-scoped queues (§0).
- No receipt confirmation by other offices.
- No email/SMS/push reminders, no scheduler/auto-expire job.
- No payments, auto-renew with vendors, or contract e-sign.
- No file uploads (invoices, receipts, contracts).
- No reports/export (CSV/PDF), no public API.

## 3. Users & Roles

Only ICT staff have accounts. Everyone else appears in the system as a **typed
name on a step**, never as a user and never as a role.

| Role | Can |
| --- | --- |
| ICT staff | Register subscriptions, submit for approval, record renewals, advance and follow the route |
| ICT head / reviewer | Everything ICT staff can, plus oversight of the approvals queue |
| Admin | Manage users, roles and offices; maintain approval flows; view audit logs |

Maps to existing tables: `users`, `roles`, `permissions`,
`role_has_permissions`, `model_has_roles`. `User::hasRole()` and
`User::hasPermission()` exist, and `UserController` already assigns a role on
create (`syncRole`) with a `superadmin` guard — but nothing else checks roles yet
(§9). There is no office-level permission to enforce (§0).

## 4. Core Entities (as built)

- `Subscription`: provider, name, cost (decimal 12,2), billing_interval +
  billing_interval_unit (month/year), start_date, renewal_date, office_id,
  owner_id, status (active/expired/cancelled/suspended/pending_approval),
  approval_flow_id, description.
- `Renewal`: subscription_id, previous/new renewal_date, previous/new cost,
  decision (renewed/cancelled/pending), reviewed_by, reviewed_at, remarks.
- `Office`: name, description, `sort_order`, `is_active`, `ordered()` scope.
- `ApprovalFlow` / `ApprovalFlowStep`: a named, ordered chain of offices; one
  flow may be `is_default`; step order is independent of `offices.sort_order`.
- `ApprovalRequest`: subscription_id, type (procurement/renewal), renewal_id,
  approval_flow_id (snapshot source, reference only), current_office_id,
  status (in_progress/completed/returned/rejected), decided_by, decided_at,
  remarks.
- `ApprovalRequestStep` — the immutable snapshot **and** the audit trail:
  approval_request_id, office_id, step_order, status
  (pending/received/approved/forwarded/returned), acted_by (the ICT staffer who
  encoded the action), acted_at, remarks, **approved_by_name** (the typed
  signatory — approve/return), **received_by_name** + **received_at** (the typed
  contact at each destination office). The pre-shape `acted_by_name` column was
  renamed to `approved_by_name` on 2026-09-24; no name is ever auto-filled from
  the acting account.
- `AuditLog`: polymorphic (auditable_type/id), action, old/new values (JSON),
  description. Written via `App\Services\AuditTrail`. **No viewer yet** — §7.
- `LoginActivity`: user_id, ip, user agent, event; written on login/logout by
  `AuthenticatedSessionController` and shown on the Activity Logs page.
- `activity_logs`: present but empty and unused — not the audit trail.

## 5. Approval Route (traceability)

Requirement: papers travel a **set, ordered sequence of offices**. Rendered as a
linear stepper: `----0-----0------0----0`.

A route (an "approval flow", admin-editable, optionally the default) is a named
list of offices — e.g. Budget → Accounting → Head — stored as
`approval_flow_steps`. It is **not** hard-coded and no longer derived from
`offices.sort_order`.

Rules (as built):

- The flow's steps are **snapshotted** into `approval_request_steps` when the
  request is created. Editing a flow later affects only future requests;
  in-flight trails are immutable.
- Exactly one current office per open request (`current_office_id`).
- No skipping steps: forward moves to the next snapshot step whose office is
  still active. A deactivated office is skipped but keeps its history row.
- **Approve** records that office's decision and is what permits forwarding;
  approving the final effective step completes the chain and applies the outcome
  (procurement → subscription `active`; renewal → the new cost/date).
- **Return** stops the chain: `status = returned`, remarks required.
- **Forward** moves the pointer and marks the next step `received`.
- Stepper states per office: done / current / todo / returned.

Traceability — the point of the route:

- **Received by** — the contact person at that office, recorded by ICT when the
  papers are submitted to it, so a pending step already names who to follow up
  with.
- **Approved by** — the office head who approved, recorded at approval time;
  this is what lets the papers move on.
- Both are typed by ICT (§0). Shipped 2026-09-24: the trail reads
  `received_by_name` / `approved_by_name` (never the logged-in user's name),
  with a legacy fallback to the step's `actor?.name`.

## 6. User Stories + Acceptance Criteria

1. Track the route: given papers sitting at office N, when ICT forwards them,
   then `current_office_id` becomes the next active snapshot step, that step is
   marked `received`, and it carries the **Received by** contact.
2. Record an approval: given papers at an office, when ICT records the approval,
   then that step is `approved` with the **Approved by** name (usually the office
   head), the stepper marks the office done, and forwarding becomes possible.
3. Admin edits a flow: given a flow, when its offices or order change, then
   future requests follow the new route while in-flight snapshots stay unchanged.
4. Traceability: given any request, when ICT opens its trail, then every office is
   listed in order with its received-by contact, approved-by name, timestamps and
   remarks.
5. Dashboard monitoring: given today, when ICT opens the dashboard, then it shows
   active count, expiring ≤ 30d, overdue, active spend, and a due-soon table with
   signed days remaining (negative = overdue).

## 7. Functional Requirements

Status markers: ✅ shipped · 🔧 partial · ⬜ missing.

- Dashboard ✅ — KPIs (active, expiring ≤ 30d, overdue, active spend) + due-soon
  tables (top 10, signed days) in `DashboardController@index`.
  **Known defect:** `total_cost` sums every non-cancelled subscription, so
  `pending_approval` rows inflate "active spend".
- Subscriptions 🔧 — CRUD shipped (no destroy; cancel via PATCH), all audited;
  the show page carries the renewal history and the route trail. ⬜ no
  search/filter/pagination: `index` loads every row with `->get()` and the list
  page has no filter UI.
- Approvals ✅ — queue (`approvals`) filtered by status/type/office with counts,
  both intake paths (`approved` / `for_approval`), and the chain actions
  `approval-requests.{approve,forward,return}` backed by
  `app/Services/ApprovalChain.php`.
- Approval flows ✅ — `approval-flows` CRUD + set-default with ordered office
  pickers.
- Offices ✅ — CRUD (no hard delete), `is_active` toggle, `sort_order` editing,
  `ordered()` scope.
- Audit 🔧 — `AuditTrail::record` fires on create/update/cancel/submit/approve/
  forward/return. ⬜ `AuditLogsController` is still an empty scaffold that type
  hints a non-existent `App\Models\audit_logs` (the model is `AuditLog`) and has
  **no route**, so the `audit_logs` rows are invisible. The routed Activity Logs
  page reads `activity_logs` + `login_activities` instead, and `activity_logs`
  is empty.
- Renewals ✅ — a `renewed`/`pending` decision opens a renewal request through the
  chain (blocked with a validation error when no flow exists); `cancelled`
  applies immediately.
- Users ✅ — CRUD with role assignment on create (`syncRole`) and a `superadmin`
  guard. ⬜ the list still loads every user instead of applying search/role
  filters server-side.
- Traceability ✅ — steps record **Received by** (typed contact + timestamp) and
  **Approved by** (typed, usually the office head) per §0/§5, captured at
  intake/forward and approve/return respectively; the trail renders both with an
  aging line. Nothing is derived from the acting account.

## 8. Screens

- Dashboard; Subscriptions list/show/create/edit; Renewal review side sheet;
  **Approvals queue** (`approvals`) with the shared action dialog; **Offices &
  Flows** — one combined side-by-side screen served from both `offices` and
  `approval-flows`, whose New/Edit actions open as right side sheets (the old
  standalone create/edit pages and their GET routes are removed); Users
  list/create/edit; Activity Logs; Settings/profile.
- Trail components: `renewal-timeline.tsx` (detailed per-office cards on
  `subscriptions/show`), `approval-stepper.tsx` (compact chip row in the queue),
  and `approval-actions.tsx` (approve / forward / return dialogs).
- All Inertia + React with shadcn Card/Table/Badge, and the existing
  `StatusBadge`, `formatPeso`, `formatDate` helpers.

## 9. Edge Cases & Rules

- Signed days: `today()->diffInDays(renewal_date, false)`; negative = overdue.
  Cancelled subscriptions are excluded from due-soon.
- Auth: all app pages sit behind the `auth` middleware. Role checks exist in the
  models but are only applied in `UserController`. No office-level authorization
  is needed or planned (§0).
- Office deactivated mid-route: in-flight trails keep their history; forwards
  skip inactive offices.
- Approving the final effective step completes the chain, and forward never moves
  the pointer past the last step, so a request cannot dead-end.
- A returned request stops the chain while the subscription stays
  `pending_approval`; there is currently no withdraw/resubmit path.
- `UserFactory` matches the schema (username/fname/lname — no `name` column).
- Background work is unused: `routes/console.php` holds no scheduled tasks and no
  jobs are dispatched, so subscriptions never auto-expire and nothing is mailed.

## 10. MVP Milestones

Progress is tracked in **`docs/approval-flows-implementation-plan.md` §0** — that
table, not this list, is the source of truth.

- P1 ✅ — auth guard, days-sign fix, dashboard KPIs, factory fix.
- P2 ✅ — offices CRUD + reorder, the approval machinery (flows, both intake
  paths, chain actions, queue, trail), audit rows, seeders.
- **Superseded** — the original P2 plan (`renewal_steps` table + `RenewalStep`
  model + `renewals.current_office_id` + a single global chain from
  `offices.sort_order`) was **dropped** in favour of
  `approval_requests` / `approval_request_steps` snapshots per flow.
- Next — typed **Received by** / **Approved by** on steps (§0, §4, §5), an audit
  log viewer, subscription list filters/pagination, and the `total_cost` fix.
- Deferred — notifications, scheduler/auto-expire, uploads, reports/export, API,
  charts.
