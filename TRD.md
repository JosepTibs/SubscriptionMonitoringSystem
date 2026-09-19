# TRD — Subscription Monitoring & Renewal System

> Companion to PRD.md | Laravel 12 + PHP 8.2 + Inertia 3 + React 19 +
> Tailwind 4/shadcn | Date: 2026-09-19

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

## 3. Database Schema (as built + planned)

Built (`database/migrations`):

- `users`: username, fname/mname/lname/sname, email, password, verified_at.
- `offices`: name, description. PLANNED delta: `sort_order INT DEFAULT 0`,
  `is_active BOOL DEFAULT true`, index on `(is_active, sort_order)`.
- `subscriptions`: provider, name, cost DECIMAL(12,2), billing_interval
  SMALLINT + unit ENUM(month,year), start/renewal DATE, office_id→offices
  NULL ON DELETE, owner_id→users NULL ON DELETE,
  status ENUM(active/expired/cancelled/suspended), description.
- `renewals`: subscription_id CASCADE DELETE, prev/new dates + costs,
  decision ENUM(renewed/cancelled/pending), reviewed_by→users,
  reviewed_at, remarks. PLANNED: `current_office_id→offices NULL`.
- `audit_logs`: user_id, action, auditable_type (basename string),
  auditable_id, description, old/new JSON.
- RBAC: `roles`, `permissions`, `role_has_permissions`, `model_has_roles`
  (morph). `login_activities`: user_id, ip, agent, event, created_at.


Planned `renewal_steps`: id, renewal_id CASCADE DELETE, office_id RESTRICT,
step_order INT, status ENUM(received/approved/forwarded/returned),
acted_by→users NULL, acted_at NULL, remarks NULL, timestamps; unique
(renewal_id, office_id, step_order); index (renewal_id, step_order).

## 4. Office Chain Logic (traceability core)

Single global chain defined by `Office::ordered()` =
`where(is_active)->orderBy(sort_order)->orderBy(id)`. Never hard-code
office ids in controllers.

- Open: `RenewalsController@store` sets `current_office_id` = first ordered
  office; writes `received` step (step_order 0) + `Renewal Reviewed` audit.
- Forward: `POST renewals/{renewal}/forward` with `to_office_id`; validate
  it is the immediate next active office after current (no skips); insert
  `forwarded` step, update `current_office_id`, audit `Renewal Forwarded`.
- Approve: `POST renewals/{renewal}/approve` with optional remarks; must be
  current office; insert `approved` step (or `returned` with required
  remarks to send back one step), audit accordingly.
- Finish: last-step forward blocked with 422 unless decision = renewed.
- Deactivation: `is_active=false` excludes office from `ordered()` and
  future forwards; history rows retained (FK RESTRICT, no hard delete).
- Stepper data: controller passes `chain: offices(ordered)` +
  `steps: renewal.steps with office,actor ordered by step_order`; frontend
  derives done/current/todo/returned per office id.

## 5. Controllers & Routes

- `DashboardController@index` (done): counts + spend + top-10 dueSoon with
  signed `days_until_renewal`; renders `dashboard`.
- `SubscriptionController`: index (signed days; TODO filters/pagination),
  create/store, show (with renewals.reviewer + days), edit/update, cancel
  (PATCH sets cancelled); all audited.
- `RenewalsController`: create/store (done) + planned `index` queue
  (pending first, paginate 15), `forward`, `approve`.
- Planned `OfficeController`: index/store/update only (no destroy; toggle
  `is_active`); validation name required≤255, sort_order int≥0.
- `AuditLogsController`: currently empty scaffold, wrong `audit_logs`
  type-hint, no route — fix to read-only `index` (paginate 20).
- `UserController`: fix `store` to attach `role_id`, apply search/role
  filters instead of `->get()` all.
- Routes: app group behind `auth` (done); add `offices` resource (except
  destroy), `renewals` index, `renewals/{renewal}/forward|approve`, and
  `audit-logs` index. File: `routes/web.php`.

## 6. Frontend Pages & Components

- `dashboard.tsx` (done): 4 KPI Cards + Due-soon Card/Table, `daysLabel`
  helper, links via `route()`.
- `subscriptions/index|show|create|edit` + `renewals/create` exist; add
  `renewals/index` queue, `offices/index|create|edit`, read-only audit list.
- New `RenewalTimeline.tsx`: horizontal `----0-----0----` stepper from
  `chain` + `steps` props; node per office showing name, actor, acted_at,
  remarks tooltip; states done/current/todo/returned with Tailwind classes
  (no new deps). Reuse on subscription show + renewal pages.
- Reuse `StatusBadge`, `formatPeso`, `formatDate`, Card primitives.

## 7. Validation, AuthZ, Audit, Testing

- Validation: subscription rules as built; renewals
  `decision required|in`, `new_* required_if:renewed`; forward requires
  `to_office_id exists:offices,id` + adjacency check; approve remarks
  required when returning.
- AuthZ: `auth` middleware (done); next add `hasPermission()` checks or
  policies (subscriptions manage, renewals review/approve, offices manage,
  audit view); prevent self-approval (reviewer ≠ owner) as 403.
- Audit: `AuditTrail::record` on every mutation with old/new diffs;
  `LoginActivity` write on login still TODO.
- Tests (Pest): DashboardTest passes; add `OfficeChainTest`
  (order respected, no-skip 422, last-step block, reorder changes target,
  deactivation skips but keeps history), renewal audit test.
  Run `php artisan test --compact`; Pint before finalize.
