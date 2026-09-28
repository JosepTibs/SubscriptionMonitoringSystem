# TRD — Subscription Monitoring & Renewal System

> Companion to PRD.md — **read PRD §0 first**: this system is operated by the
> **ICT department only**; the offices on the route are waypoint references for
> tracking where papers physically travel, not participants. No other office
> logs in, confirms receipt, or has an account. Anything requiring another office
> to act in the system is out of scope.
>
> Laravel 12 + PHP 8.2 + Inertia 3 + React 19 + Tailwind 4/shadcn |
> Revised: 2026-09-24 (originally drafted 2026-09-19).

## 1. Architecture

Monolith, server-driven routing. Laravel owns routes, validation,
persistence; React owns presentation via Inertia pages (no separate API).
`bootstrap/app.php` wires web routes + middleware; `routes/web.php` guards
app pages behind `auth`; `routes/settings.php` + `auth.php` handle account.

Request flow: Inertia page → Controller (validate → mutate → AuditTrail) →
Inertia render with props → React component (`resources/js/pages/**`).

## 2. Stack & Conventions

- Backend: Laravel 12, Pest 3, Pint, `Carbon::today()->diffInDays($d,false)`
  for signed days (negative = overdue).
- Frontend: `@inertiajs/react`, shadcn `Card/Table/Badge/Button`,
  `route()` via Ziggy, helpers `formatPeso/formatDate` in `@/lib/format`,
  `StatusBadge` for status enum.
- Types: `resources/js/types/index.ts` (`Subscription`, `Renewal`,
  `Office`, `User`); props passed as `stats`, `dueSoon`, `subscriptions`.
- Style: constructor promotion, explicit return types, PHPDoc array shapes,
  curly braces always; run Pint before finalize.

## 3. Database Schema (as built)

Migrations in `database/migrations`:

- `users`: username, fname/mname/lname/sname, email, password, verified_at.
- `offices`: name, description, `sort_order` (added 2026_09_19), `is_active`;
  `Office::ordered()` = `where(is_active)->orderBy(sort_order)->orderBy(id)`.
- `subscriptions`: provider, name, cost DECIMAL(12,2), billing_interval SMALLINT
  + unit ENUM(month,year), start/renewal DATE, office_id→offices NULL ON DELETE,
  owner_id→users NULL ON DELETE, status
  ENUM(active/expired/cancelled/suspended/pending_approval), approval_flow_id
  →approval_flows NULL ON DELETE, description.
- `renewals`: subscription_id CASCADE DELETE, prev/new dates + costs, decision
  ENUM(renewed/cancelled/pending), reviewed_by→users, reviewed_at, remarks.
- `approval_flows`: name (unique), description, is_default;
  `approval_flow_steps`: flow→CASCADE DELETE, office→RESTRICT,
  step_order, unique(flow, office) — ordered by `step_order`, independent of
  `offices.sort_order`.
- `approval_requests`: subscription→CASCADE DELETE, type (procurement|renewal),
  renewal_id→NULL ON DELETE, approval_flow_id→NULL ON DELETE (snapshot source
  reference), current_office_id→offices NULL ON DELETE, status
  (in_progress|completed|returned|rejected), decided_by, decided_at, remarks.
- `approval_request_steps`: request→CASCADE DELETE, office→RESTRICT, step_order,
  status (pending|received|approved|forwarded|returned), acted_by→users NULL,
  acted_by_name, acted_at, remarks; unique(request, office).
- `audit_logs`: user_id→users NULL ON DELETE, action, auditable_type (basename
  string), auditable_id, description, old/new JSON.
- `login_activities`: user_id, ip, user_agent, event, created_at — written on
  login/logout.
- `activity_logs`: user_id (CASCADE), subject_type/id, event, description,
  ip, user_agent, properties — **empty and unused**.
- RBAC: `roles`, `permissions`, `role_has_permissions`, `model_has_roles`
  (morph).


**Dropped — do not reintroduce:** `renewal_steps` (table), the `RenewalStep`
model, and `renewals.current_office_id`. They were replaced by
`approval_requests` / `approval_request_steps`.

**Shipped 2026-09-24** (per PRD §0/§5): on `approval_request_steps`,
`acted_by_name` was renamed to `approved_by_name`, and `received_by_name` +
`received_at` were added, so the trail records the receiving contact and the
approving head as typed values instead of auto-filling the acting account's
name. See `docs/received-by-approved-by-implementation-plan.md`.

## 4. Approval Route Logic (traceability core)

> **Superseded design — do not rebuild.** The original plan (a single global
> chain from `Office::ordered()`, `renewals.current_office_id`, and
> `POST renewals/{renewal}/forward` with `to_office_id` + adjacency validation)
> was never implemented; its columns and model were removed. It is recorded here
> only so nobody reintroduces it.

As built, all in `app/Services/ApprovalChain.php`:

- `flowFor($subscription, $flowId)` — the explicit flow, else the subscription's
  `approvalFlow`, else `ApprovalFlow::defaultFlow()`.
- `start($subscription, $flow, $type, $renewal = null)` — creates the
  `approval_requests` row and **snapshots** the flow's steps into
  `approval_request_steps` (`step_order` = index + 1, status `pending`), seating
  `current_office_id` on the first snapshot step whose office is still active
  (falling back to the first step, so a fully deactivated flow still has a home).
- `complete($request, $user)` — applies the outcome (`active` for procurement; the
  renewal's new date/cost plus `active` for a `renewed` decision), sets
  `status = completed` with `decided_by`/`decided_at`, and audits
  `Approval Completed`.

Runtime, in `ApprovalRequestController`:

- `approve` — the current step becomes `approved` with actor, timestamp and
  remarks; on the final effective step it calls `complete()`. Forwarding is only
  allowed once the step is `approved`.
- `forward` — marks the step `forwarded`, moves `current_office_id` to the next
  **active** snapshot step and marks it `received`; if no active step remains
  ahead it completes the chain instead of stranding the request. Deactivated
  offices keep their history rows.
- `return` — step and request become `returned` (remarks required) with
  `decided_by`/`decided_at` set; the in-progress guard then blocks further
  actions.
- Every action aborts with 403 when the request is no longer `in_progress`.

**Not built, by design (PRD §0):** office-scoped authorization. Other offices
have no accounts, so there is no user↔office comparison to enforce.

## 5. Controllers & Routes

- `DashboardController@index`: 4 stats + two due-soon lists (`limit(10)`, signed
  `days_until_renewal`); renders `dashboard`.
- `SubscriptionController`: index (no filters/pagination yet), create/store
  (`intake_mode` → `ApprovalChain::start` for `for_approval`), show (renewals +
  approval requests with steps/offices/actors), edit/update, cancel (PATCH); all
  audited.
- `SubscriptionController::edit` currently names its office collection
  `$waaagh` — worth renaming while in the file.
- `RenewalsController@store`: records the decision; `renewed`/`pending` open a
  renewal request through the chain (validation error when no flow exists),
  `cancelled` applies immediately.
- `ApprovalRequestController`: `index` (queue with status/type/office filters and
  counts), `approve`, `forward`, `return` — routes `approvals` and
  `approval-requests.{approve,forward,return}`.
- `ApprovalFlowController`: resource except show/destroy + `set-default`.
- `OfficeController`: resource except show/destroy + `toggle-active`, `move`.
- `UserController`: CRUD; `store` assigns the role through `syncRole`; the
  `superadmin` assignment is guarded.
- `ActivityLogsController@index`: read-only Activity Logs page (reads
  `activity_logs` + `login_activities`).
- `AuditLogsController`: still an empty scaffold — it type hints a non-existent
  `App\Models\audit_logs` (the model is `AuditLog`) and has no route, so the
  `audit_logs` trail stays invisible until this is fixed.
- Routes: one `auth` group in `routes/web.php`, plus `routes/settings.php` and
  `routes/auth.php`. Note the `profile` route is registered twice
  (`profile.show`, two adjacent lines).

## 6. Frontend Pages & Components

- `dashboard.tsx`: 4 KPI Cards + due-soon tables, `daysLabel` helper, `route()`
  links.
- `subscriptions/{index,show,create,edit}` with
  `partials/subscription-form.tsx` (intake toggle + flow select);
  `subscriptions/show` renders the renewal side sheet and the route trail.
- `approvals/index.tsx`: the queue (filters + counts) reusing
  `approval-stepper.tsx` and `approval-actions.tsx`.
- `approval-flows/{index,create,edit}` + `partials/flow-form.tsx` (ordered office
  picker).
- `offices/{index,create,edit}` + `partials/office-form.tsx`;
  `users/{index,create,edit}` with create/edit sheets; `activity-logs.tsx`;
  settings/profile pages.
- Trail rendering is split deliberately: `renewal-timeline.tsx` (detailed
  per-office cards, `subscriptions/show`) and `approval-stepper.tsx` (compact
  chip row, queue). Both derive state through `trailStepState()`; do not
  consolidate them — they serve different densities.
- Reuse `StatusBadge`, `formatPeso`, `formatDate`, Card primitives.

## 7. Validation, AuthZ, Audit, Testing

- Validation: subscription rules in `SubscriptionController::subscriptionRules()`
  (plus `intake_mode` and `approval_flow_id`); renewals `decision required|in`,
  `new_* required_if:renewed`; chain actions validate `remarks` (`required` when
  returning).
- AuthZ: `auth` middleware on the app group. Role checks exist
  (`User::hasRole()`, `User::hasPermission()`) but are only applied in
  `UserController` (role assignment + `superadmin` guard). Office-level
  authorization is deliberately **not** planned — see PRD §0; other offices have
  no accounts, so there is nothing to compare.
- Audit: `AuditTrail::record` on every mutation with old/new diffs
  (`Subscription Created/Updated/Cancelled`, `Renewal Reviewed`,
  `Subscription Submitted for Approval`, `Approval Approved/Forwarded/Returned/
  Completed`). Login and logout rows are written by
  `AuthenticatedSessionController` into `login_activities`.
- Tests (Pest, sqlite `:memory:` with `RefreshDatabase`): `DashboardTest`,
  `ApprovalFlowTest`, `ApprovalFlowModelTest`, `ApprovalsQueueTest`,
  `ApprovalChainTest`, `RenewalApprovalTest`, `SubscriptionApprovalTrailTest`,
  `SubscriptionIntakeTest`, `OfficeTest`. A full run takes ~70 s and
  `npm run build` ~80 s — both beyond a 30-second shell limit, so use the
  detached recipe in `docs/approval-flows-implementation-plan.md` §12.10.
  Run `vendor/bin/pint --dirty --format agent` before finalizing.
