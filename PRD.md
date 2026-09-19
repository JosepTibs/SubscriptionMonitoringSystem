# PRD — Subscription Monitoring & Renewal System

> Status: MVP draft | Stack: Laravel 12 + Inertia + React + Tailwind/shadcn | Date: 2026-09-19

## 1. Overview

Internal system that tracks organizational subscriptions (provider, cost,
billing interval, start/renewal dates, status, owning office, owner) and the
renewal review workflow (renewed / cancelled / pending with cost and date
changes). Every change is audited (`audit_logs`) and logins are tracked
(`login_activities`).

Core loop: `login → dashboard shows what is due → search/filter
subscriptions → create/edit/cancel → record renewal decision → see history
and audit trail → manage users/offices`.

## 2. Goals / Non-goals

Goals (MVP):

- Know what renews soon, what is overdue, and total active spend.
- Record renewal decisions with before/after cost and dates.
- Trace where renewal papers are in the office approval chain
  (`----0-----0------0----0`) including who accepted and when.
- Manage offices (orderable, deactivatable without code changes).
- Role-based access with full audit trail.

Non-goals (explicitly out of MVP):

- No email/SMS/push reminders, no scheduler/auto-expire job.
- No payments, auto-renew with vendors, or contract e-sign.
- No file uploads (invoices, receipts, contracts).
- No reports/export (CSV/PDF), no public API.
- One global office chain only (no per-office/per-cost custom chains).

## 3. Users & Roles

| Role | Can |
| ---- | --- |
| Requester / Owner | Create/edit own subscriptions, submit for renewal review |
| Reviewer | Record renewal decisions (`renewed/cancelled/pending`), forward papers |
| Office approver | Accept/approve at their office step, add remarks |
| Admin | Manage users, roles, offices + order; view audit logs |

Maps to existing tables: `users`, `roles`, `permissions`,
`role_has_permissions`, `model_has_roles`. `User::hasPermission()` exists
but is not yet enforced in controllers — must be enforced (see §9).

## 4. Core Entities (as built)

- `Subscription`: provider, name, cost (decimal 12,2), billing_interval +
  billing_interval_unit (month/year), start_date, renewal_date, office_id
  (owner office), owner_id, status (active/expired/cancelled/suspended),
  description.
- `Renewal`: subscription_id, previous/new renewal_date, previous/new cost,
  decision (renewed/cancelled/pending), reviewed_by, reviewed_at, remarks.
- `Office`: name, description. **Planned:** `sort_order int default 0`,
  `is_active bool default true`, `ordered()` scope.
- `RenewalStep` (new, planned): renewal_id, office_id, step_order, status
  (received/approved/forwarded/returned), acted_by, acted_at, remarks.
  Plus `renewals.current_office_id` pointer for "where is it now".
- `AuditLog`: polymorphic (auditable_type/id), action, old/new values
  (JSON), description. Written via `App\Services\AuditTrail`.
- `LoginActivity`: user_id, ip, user agent, event (model exists, not yet
  written on login).

## 5. Office Approval Chain (traceability)

Client requirement: renewals travel a **set, ordered sequence of offices**.
Render as a linear stepper: `----0-----0------0----0`.

Default chain (seeded, admin-editable): Requesting office → ICT → Budget →
Accounting → Head. Stored as `offices.sort_order`, not hard-coded.

Rules:

- Exactly one current office per open renewal (`current_office_id`).
- No skipping steps; forward moves to next `sort_order` among active offices.
- Cannot forward from last step unless `decision = renewed`.
- Each handoff creates a `renewal_steps` row with office, status, actor,
  timestamp, remarks (who accepted the papers + when).
- Deactivating an office (`is_active = false`) removes it from future
  forwards but preserves history rows.
- Stepper states per office: done / current / todo / returned.

## 6. User Stories + Acceptance Criteria

1. Reviewer forwards renewal: given renewal at office N, when I forward,
   then `current_office_id` = office N+1 and a `forwarded` step row exists
   with my id and timestamp.
2. Approver accepts papers: given renewal at my office, when I approve,
   then an `approved` step row exists and stepper marks my office done.
3. Admin reorders offices: given offices list, when I change `sort_order`,
   then next forward targets follow the new order with no code deploy.
4. Traceability: given any renewal, when I open its trail, then I see every
   office, actor, timestamp, and remarks in order.
5. Dashboard monitoring: given today, when I open dashboard, then I see
   active count, expiring ≤ 30d, overdue, active spend, and due-soon table
   with signed days remaining (negative = overdue).

## 7. Functional Requirements

- Dashboard: KPIs (active, expiring ≤ 30d, overdue, active spend) + due-soon
  table (top 10, signed days). Done in `DashboardController@index`.
- Subscriptions: CRUD (no destroy; cancel via PATCH), filters (search, status,
  office), pagination. Show page includes renewal history + trail stepper.
- Renewals: queue page (`pending` first), create/store decision, forward and
  approve-at-office actions with step validation.
- Offices: CRUD (no hard delete; `is_active` toggle), `sort_order` editing,
  ordered scope used by chain logic and stepper.
- Audit: read-only `audit-logs/index` (fix empty `AuditLogsController`,
  add route). Record on create/update/cancel/forward/approve.
- Users: CRUD + role attach on store (currently validated but ignored),
  working search/role filters.

## 8. Screens

- Dashboard, Subscriptions list/show/create/edit, Renewal review + queue,
  Renewal trail stepper (`RenewalTimeline.tsx`), Offices list/create/edit,
  Users list, Audit log list. All Inertia + React, shadcn Card/Table/Badge,
  existing `StatusBadge`, `formatPeso`, `formatDate` helpers.

## 9. Edge Cases & Rules

- Signed days: `today()->diffInDays(renewal_date, false)`; negative =
  overdue. Cancelled excluded from due-soon.
- Auth: all app routes behind `auth` middleware (done); add permission
  checks via `hasPermission()` / policies next.
- Office deactivated mid-chain: in-flight renewals keep history; forwards
  skip inactive offices.
- Last-step forward blocked unless decision renewed; cannot skip steps.
- `UserFactory` fixed to username/fname/lname (no `name` column).

## 10. MVP Milestones

- P1 done: auth guard, days-sign fix, dashboard KPIs, factory fix.
- P2 next: offices CRUD + reorder → `renewal_steps` migration/models →
  forward/approve actions → timeline component → audit viewer → seeders.
- Deferred: notifications, scheduler, uploads, reports/export, API, charts.
