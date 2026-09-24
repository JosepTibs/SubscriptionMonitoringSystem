# Implementation Plan — Approval Flows, Subscription Intake & Renewal Chain

> Companion to `PRD.md` (not present in this repo yet). Covers the generalized
> approval machinery (procurement + renewals), named office flows, and the
> remaining P2 items.
> Stack: Laravel 12 + Inertia (React) + Tailwind/shadcn. Conventions follow
> `SubscriptionController` / `UserController` (validate → act → `AuditTrail::record`
> → redirect with flash).

---

## 0. Status at a glance

> Last updated: 2026-09-23 · branch `Milestone4`.
> This table is the single source of truth for progress — update the **Status**
> column as steps land, and put anything new in **§12 Backlog / additions**
> instead of rewriting the milestones. §9 keeps the original build order.
> As-built decisions that differ from the sketches below are logged in **§11**.

| # | Milestone | Status | Evidence in the repo | Left to do |
| --- | --- | --- | --- | --- |
| 1 | Flows CRUD + `subscriptions.approval_flow_id` | ✅ Done | `ApprovalFlowController`, `resources/js/pages/approval-flows/*`, `tests/Feature/ApprovalFlowTest.php`, `ApprovalFlowModelTest.php` | — |
| 2 | Status + two-path intake | ✅ Done | `SubscriptionController@store` (`intake_mode`), `tests/Feature/SubscriptionIntakeTest.php` | — |
| 3 | Chain runtime | ✅ Done (as-built: §11.1–§11.5) | `app/Services/ApprovalChain.php`, `app/Http/Controllers/ApprovalRequestController.php`, routes `approval-requests.{approve,forward,return}`, `tests/Feature/ApprovalChainTest.php` | — |
| 4 | Renewal wiring | ✅ Done (as-built: §11.6) | `RenewalsController@store` → `ApprovalChain::start(TYPE_RENEWAL)`, `tests/Feature/RenewalApprovalTest.php` | — |
| 5 | Queue + real stepper | ⬜ **Next** | trail done: `resources/js/components/renewal-timeline.tsx` reads `approval_request_steps` | `approvals/index` page + controller/route + sidebar entry + Approve/Forward/Return actions; optional dashboard KPI |
| 6 | Cleanup | 🟡 Mostly done | `RenewalStep` model, `create_renewal_steps_table` migration and `renewals.current_office_id` already removed (no references left in `app/`, `database/`, `tests/`) | final Pint + full suite + `npm run build` pass |

**Next up:** §8 approvals queue. The runtime is finished and tested, but **no
screen calls it yet** — `subscriptions/show` renders the trail read-only, so a
`pending_approval` subscription or a renewal proposal cannot be advanced from the
UI until the queue/actions land (§12.5).

Verified at the last full run: **74 tests passed / 390 assertions**
(`php artisan test --compact`), `vendor/bin/pint` clean, `npm run build` green.

---

## 1. Concept

Two intake paths for subscriptions, one shared approval engine:

| Path | What happens |
| --- | --- |
| **A — Already approved (direct entry)** | Created as `active` immediately. No chain. Optional `approved_by` / `approved_at` metadata. |
| **B — For approval / procurement** | Created as `pending_approval`, attached to an **approval flow**; papers travel the chain (`----0-----0------0----0`); final office approval flips status to `active`. |

**Renewals** reuse the same engine: recording a renewal decision creates a
`type = renewal` approval request; final approval applies the new cost/date/status.

Key principle: **snapshot at request creation**. When a request is created, its
flow's steps are copied into `approval_request_steps`. Editing a flow later
affects only future requests; in-flight trails are immutable (PRD §5 traceability).

---

## 2. Schema changes (new migrations)

### 2.1 `create_approval_flows_table`

```php
Schema::create('approval_flows', function (Blueprint $table) {
    $table->id();
    $table->string('name')->unique();
    $table->text('description')->nullable();
    $table->boolean('is_default')->default(false);
    $table->timestamps();
});
```

### 2.2 `create_approval_flow_steps_table`

```php
Schema::create('approval_flow_steps', function (Blueprint $table) {
    $table->id();
    $table->foreignId('approval_flow_id')->constrained()->cascadeOnDelete();
    $table->foreignId('office_id')->constrained()->restrictOnDelete();
    $table->unsignedInteger('step_order')->default(0);
    $table->timestamps();
    $table->unique(['approval_flow_id', 'office_id']);
});
```

> Flow step order is **independent** of `offices.sort_order` — the office chain
> order is only a convenience default when building a flow.

### 2.3 `add_approval_flow_to_subscriptions_table`

```php
Schema::table('subscriptions', function (Blueprint $table) {
    $table->foreignId('approval_flow_id')->nullable()
          ->constrained()->nullOnDelete()->after('status');
});
```

- `null` = use the default flow.
- Update `Subscription::$fillable` and the `subscriptionRules()` status enum.

### 2.4 Status enum: `pending_approval`

- No schema change needed (status is a string); just extend the validation enum:
  `in:active,expired,cancelled,suspended,pending_approval`.
- Add `pending_approval` styling to `resources/js/components/status-badge.tsx`
  (amber/secondary badge).

### 2.5 `create_approval_requests_table`

```php
Schema::create('approval_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
    $table->string('type');                 // procurement | renewal
    $table->foreignId('renewal_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('approval_flow_id')->nullable()->constrained()->nullOnDelete(); // snapshot source, reference only
    $table->foreignId('current_office_id')->nullable()->constrained('offices')->nullOnDelete();
    $table->string('status')->default('in_progress'); // in_progress | completed | returned | rejected
    $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('decided_at')->nullable();
    $table->text('remarks')->nullable();
    $table->timestamps();
});
```

### 2.6 `create_approval_request_steps_table` (replaces planned `renewal_steps`)

```php
Schema::create('approval_request_steps', function (Blueprint $table) {
    $table->id();
    $table->foreignId('approval_request_id')->constrained()->cascadeOnDelete();
    $table->foreignId('office_id')->constrained()->restrictOnDelete();
    $table->unsignedInteger('step_order')->default(0);   // order within the snapshot
    $table->string('status')->default('pending');        // pending | received | approved | forwarded | returned
    $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('acted_at')->nullable();
    $table->text('remarks')->nullable();
    $table->timestamps();
    $table->unique(['approval_request_id', 'office_id']);
});
```

> Drop the existing `create_renewal_steps_table` migration / `RenewalStep`
> model, and `renewals.current_office_id` (superseded by
> `approval_requests.current_office_id`) — keep the repo clean before shipping.

---

## 3. Models

| Model | Notes |
| --- | --- |
| `ApprovalFlow` | `hasMany steps` (ordered by `step_order`); factory + helper `defaultFlow()`; boot guard: exactly one `is_default` (unset others when one is set). |
| `ApprovalFlowStep` | `belongsTo flow`, `belongsTo office`. |
| `ApprovalRequest` | `belongsTo subscription`, `belongsTo renewal`, `hasMany steps` ordered, `belongsTo currentOffice`; constants for `type` and `status`; scope `atOffice($officeId)` → `in_progress` + `current_office_id = $officeId`. |
| `ApprovalRequestStep` | `belongsTo request`, `belongsTo office`, `belongsTo actor`. |
| `Subscription` | add `approvalFlow()` relation, `pending_approval` status. |

---

## 4. Milestone 1 — Flows admin CRUD

**Status:** ✅ Done — `ApprovalFlowController` + `resources/js/pages/approval-flows/*`, covered by `ApprovalFlowTest` and `ApprovalFlowModelTest`.

**Routes** (auth group):

```php
Route::resource('approval-flows', ApprovalFlowController::class)
    ->except(['show', 'destroy']);
Route::patch('approval-flows/{approval_flow}/set-default', ...)
    ->name('approval-flows.set-default');
```

**`ApprovalFlowController`** (mirrors `OfficeController`):

- `index` — flows with steps (eager `steps.office`), mini-stepper preview.
- `create` / `store` — validate `name` (unique), `description`, `steps` =
  ordered array of `office_id`s (unique per flow); steps stored with
  `step_order` = index + 1.
- `edit` / `update` — same; replacing steps is always allowed (in-flight
  snapshots are independent); audit old/new step lists.
- `setDefault` — sets `is_default`, clears the previous default. Audit.

**Pages** (`resources/js/pages/approval-flows/`):

- `index.tsx` — table: name, stepper preview (`0 → 0 → 0` with office names),
  default badge, actions (Edit, Set Default).
- `create.tsx` / `edit.tsx` + `partials/flow-form.tsx` — name, description,
  office-picker builder: "Add office" select + ordered list with
  up/down/remove; prefill ordering from `Office::ordered()`.

**Subscription forms** — "Approval flow" select on
`subscriptions/partials/subscription-form.tsx` (placeholder "Default flow").

**Tests** (`tests/Feature/ApprovalFlowTest.php`): CRUD validation, unique name,
step ordering, set-default exclusivity, office uniqueness per flow, audit rows.

---

## 5. Milestone 2 — Intake: two-path subscription creation

**Status:** ✅ Done — `intake_mode` radio on `subscriptions/create.tsx`, snapshot via `ApprovalChain::start`; `SubscriptionIntakeTest` covers both paths, the default-flow fallback and the "no flow" block.

`SubscriptionController@store` / `create` accept:

```php
'intake_mode' => ['required', 'in:approved,for_approval'],
'approval_flow_id' => ['nullable', 'exists:approval_flows,id',
                        'required_if:intake_mode,for_approval'],
```

- `approved` → status `active` (or chosen status), no request.
  (Optional future: `approved_by` / `approved_at` columns.)
- `for_approval` → status `pending_approval`; create
  `ApprovalRequest(type: procurement)` + **snapshot steps** from the effective
  flow (subscription's flow → default flow); `current_office_id` = first
  active step. Audit "Subscription Submitted for Approval".

UI: "Approval" section on `subscriptions/create.tsx` — radio toggle
("Already approved" / "Send for approval") + flow select on the latter.

**Tests**: direct entry → active, no request; for-approval →
`pending_approval`, request + snapshot rows, audit recorded.

---

## 6. Milestone 3 — Chain runtime: forward / approve / return

**Status:** ✅ Done — `app/Http/Controllers/ApprovalRequestController.php` + `app/Services/ApprovalChain.php` (shared engine, §11.4); 12 tests in `tests/Feature/ApprovalChainTest.php`. Two rules were reconciled during implementation: authorization (§11.1) and the completion trigger (§11.2). The routes below use `{approval_request}` instead of `{request}` (§11.3).

**`ApprovalRequestController`** (new) with routes:

```php
Route::patch('approval-requests/{request}/forward', ...)->name('approval-requests.forward');
Route::patch('approval-requests/{request}/approve', ...)->name('approval-requests.approve');
Route::patch('approval-requests/{request}/return',  ...)->name('approval-requests.return');
```

Server-enforced rules (PRD §5/§9):

1. Only act on requests where `current_office_id` matches the acting user's
   office (MVP: reviewer/admin may act at any office; wire `hasRole` when
   permissions land).
2. **Approve** → current step `approved` with `acted_by`, `acted_at`, remarks.
   Does NOT move the pointer.
3. **Forward** → requires current step `approved`; pointer moves to the next
   snapshot step **whose office is still active** (skip inactive); writes a
   `forwarded` row for the handing-off office.
4. **Return** → step `returned`; request `status = returned`; remarks required.
5. **Last step**: forward past it is blocked; completing the chain:
   - `procurement` → subscription `status = active`.
   - `renewal` → apply linked renewal's new date/cost/decision to the
     subscription (logic moved from `RenewalsController@store`).
   - request `status = completed`, `decided_by/at` set. Audit "Approval
     Completed".
6. Every action → `AuditTrail::record`.

**Tests**: skip-inactive, no step skipping, last-step guard, completion flips
subscription / applies renewal, return blocks further forwarding,
wrong-office 403, audit assertions.

---

## 7. Milestone 4 — Renewal wiring

**Status:** ✅ Done — `RenewalsController@store` resolves the flow before writing, opens `ApprovalRequest(type: renewal, renewal_id)` + snapshot for `renewed`/`pending`, and applies `cancelled` immediately. The former direct subscription update is gone (now `ApprovalChain::complete`, §11.2). 5 tests in `tests/Feature/RenewalApprovalTest.php`; §11.6 records the "no flow configured" behavior and §11.7 the side-sheet copy change.

- `RenewalsController@store` (used by the renewal side sheet on
  `subscriptions/show`): after creating the `Renewal`, for decisions
  `renewed`/`pending` → create `ApprovalRequest(type: renewal, renewal_id)`
  + snapshot. `cancelled` applies immediately (no chain), as today.
- Remove the direct subscription update from `store` — moved to chain
  completion (§6 rule 5).

**Tests**: renewal → request + snapshot; completion applies new cost/date;
`cancelled` path unchanged.

---

## 8. Milestone 5 — Screens

**Status:** ⬜ **Next (the active step).** Intake toggle, flows CRUD and the real
trail already exist from earlier milestones; the queue and the chain actions are
what remain — and until the actions exist, chains cannot be advanced from the UI.

| Screen | Work | Status |
| --- | --- | --- |
| `subscriptions/create` / `edit` | Intake toggle + flow select | ✅ Done in milestone 2 |
| `subscriptions/show` | Real trail stepper from `approval_request_steps` — replace `renewal-timeline-mock.tsx` with `RenewalTimeline.tsx` (done / current / todo / returned states, actor + timestamp + remarks) | 🟡 Trail done (`renewal-timeline.tsx`, mock deleted); still needs the Approve / Forward / Return actions |
| **new** `approvals/index` | Queue: `in_progress` requests at my office (type filter), Approve / Forward / Return actions with remarks | ⬜ **Next** — no page, controller, route or sidebar entry exists yet |
| **new** `approval-flows/*` | Flows admin CRUD (milestone 1) | ✅ Done |
| Dashboard | Optional KPI: pending-approval count + queue link | ⬜ Open → §12.6 |

Shared component: `resources/js/components/approval-stepper.tsx` — renders the
`----0-----0------0----0` line from a request's steps.

> As built: `resources/js/components/renewal-timeline.tsx` already renders every
> trail state (done / current / todo / returned, actor, timestamp, remarks) from
> `approval_request_steps`, so no separate `approval-stepper.tsx` was extracted
> (§11.8). The queue page should reuse it plus one shared action component.
> "At my office" cannot be derived yet — see §12.4 / §11.1.

---

## 9. Build order & definition of done

Per-milestone status lives in **§0** (single source of truth) so the two tables
cannot drift; this one keeps the original order and definition of done.

| # | Milestone | Done when | Status |
| --- | --- | --- | --- |
| 1 | Flows CRUD + `subscriptions.approval_flow_id` | CRUD end-to-end, default-flow exclusivity, tests green | ✅ Done |
| 2 | Status + two-path intake | Direct vs for-approval creation with snapshot; tests green | ✅ Done |
| 3 | Chain runtime | All §6 rules enforced; full coverage; audits written | ✅ Done (§11.1–§11.3 cover the enforced-rule adjustments) |
| 4 | Renewal wiring | Renewals route through chain; completion applies changes | ✅ Done |
| 5 | Queue + real stepper | Office approvers see their queue + live trail; mock removed | ⬜ **Next** — mock removed, queue pending |
| 6 | Cleanup | Drop `renewal_steps` model/migration + `renewals.current_office_id`; Pint clean; full suite + `npm run build` green | 🟡 Drops done; final verification pass pending |

Per-change workflow: `vendor/bin/pint --dirty --format agent`, feature test for
the change, `npm run build`, full `php artisan test --compact` before moving on.

> The full suite only moves as a whole once per milestone — run it detached
> (e.g. redirect `php artisan test --compact` to a log and poll) because a run
> takes ~2½ minutes, which exceeds a 30-second shell limit.

---

## 10. Edge cases checklist

- [x] Office deactivated mid-flight → skipped on next forward, history intact
      (`ApprovalChainTest`: "skips deactivated offices when forwarding and keeps
      their history intact")
- [ ] Flow edited mid-flight → in-flight snapshots unchanged — **guaranteed by
      design** (steps are copied in `ApprovalChain::start`) but not yet proven by
      a test → §12.2
- [x] Flow referenced → protected from delete; only future requests affected — no
      `destroy` route is registered for flows, and every `approval_flow_id` FK is
      `nullOnDelete`, so history is never orphaned
- [x] No default flow exists → for-approval intake blocked with a helpful message
      (`abort_unless(..., 422)` in `SubscriptionController@store`). A
      `renewed`/`pending` renewal is blocked the same way with a validation error
      on `decision`, and nothing is written (§11.6)
- [ ] Subscription deleted → requests cascade-delete; audit logs keep history —
      `cascadeOnDelete` is in `create_approval_requests_table`, but no test covers
      it → §12.2
- [x] Last-step forward without final approval → blocked (`ApprovalChainTest`:
      "blocks forwarding the final step until that office has approved")
- [ ] `pending_approval` subscriptions excluded from dashboard "active spend" and
      due-soon — **half true**: due-soon / expiring / overdue filter
      `status = active`, but the "Active spend" card (`total_cost`) sums every
      non-cancelled subscription → §12.1
- [x] Every chain action writes an audit row — `Approval Approved`,
      `Approval Forwarded`, `Approval Returned`, `Approval Completed`
      (asserted in `ApprovalChainTest`)
- [x] Last-step completion is explicit — approving the final effective step closes
      the chain and applies the outcome (§11.2)
- [ ] NEW — a subscription can hold two in-flight requests (record two renewal
      decisions → two chains) → §12.3
- [ ] NEW — nothing in the UI can advance a chain yet; the queue is milestone 5
      → §8 / §12.5

---

## 11. Deviations & as-built decisions

Recorded so nobody has to re-derive them. **Append here** — do not rewrite the
milestone sketches above.

**11.1 Office-scoped authorization (§6 rule 1) is not enforceable yet.**
`users` has no `office_id` column (only `username` / `fname` / `mname` / `lname` /
`sname` / `email`) and the only seeded role is `admin` (`RoleSeeder`), so there is
nothing to compare `current_office_id` against. Following the parenthetical in §6
("MVP: reviewer/admin may act at any office"), any authenticated user may act, and
the planned "wrong-office 403" test became **"acting on a request that is no longer
`in_progress` → 403"**. Real scoping needs `users.office_id` plus a `hasRole`
bypass → §12.4.

**11.2 Chain completion trigger (§6 rules 3/5 reconciled).**
"Forward past it is blocked" vs "final office approval flips status to `active`"
is implemented as: `approve` on the final **effective** step completes the chain;
`forward` never moves the pointer past the last step, and when no active office
remains ahead (every later office deactivated mid-flight) it completes the chain
instead of stranding the request. A request therefore never dead-ends, and
`current_office_id` stays on the final office.

**11.3 Route parameter name.**
Routes use `{approval_request}`, not the §6 sketch's `{request}`, because a route
parameter named `request` is confusing next to the injected
`Illuminate\Http\Request`; controller signatures read
`approve(Request $request, ApprovalRequest $approvalRequest)`.

**11.4 One shared engine.**
`app/Services/ApprovalChain.php` (`flowFor` / `start` / `complete`) now backs
procurement intake, renewal wiring and the runtime. The snapshot code that used to
live privately in `SubscriptionController::createProcurementRequest()` was
extracted there, and `start()` seats the pointer on the first snapshot step whose
office is still active (falling back to the first step).

**11.5 `return` is attributable.**
Besides the step + request status/remarks required by §6 rule 4, `return` also
sets request-level `decided_by` / `decided_at`, so terminal states are traceable
without joining the step row.

**11.6 Renewals need a flow.**
`renewed` / `pending` resolve the flow as subscription's flow → default flow
(`ApprovalChain::flowFor`). If neither exists, `RenewalsController@store` throws a
validation error on `decision` **before writing anything** (no `Renewal` row, no
request). `cancelled` still applies immediately with no chain.

**11.7 UI copy follows the behavior.**
`renewal-review-sheet.tsx` now states that renewed/pending decisions travel the
approval chain and only apply once the final office approves.

**11.8 No `approval-stepper.tsx` extraction.**
`resources/js/components/renewal-timeline.tsx` already renders the full
`----0-----0------0----0` line with done / current / todo / returned states, actor,
timestamp and remarks, so it serves as the shared stepper; the mock it replaced is
deleted.

---

## 12. Backlog / additions

New work goes here (milestone-level items also get a §0 row). Roughly prioritised.

**12.1 Dashboard "Active spend" includes `pending_approval` (bug).**
`DashboardController` builds `total_cost` from
`Subscription::whereNot('status', 'cancelled')`, so unapproved subscriptions
inflate the card. Filter to `status = 'active'` (or exclude
`pending_approval` + `expired`) and add a `DashboardTest` case.

**12.2 Missing edge-case tests.** Snapshot immutability when a flow is edited
mid-flight (create request → change the flow's steps → assert
`approval_request_steps` unchanged) and cascade-delete of requests when a
subscription is deleted.

**12.3 Duplicate in-flight requests.** Nothing stops a second `renewed` decision
(or a second procurement submission) for a subscription that already has an
`in_progress` request. Consider blocking with a validation error or returning the
existing request from the queue instead.

**12.4 Real office scoping / "my office" queue.** Add `users.office_id`
(migration + factory + `UserController` form + seeder), then enforce §6 rule 1
(`current_office_id === user->office_id`, with an `admin`/`reviewer` bypass via
`hasRole`) and default the queue to the acting user's office.

**12.5 Approvals queue UI (milestone 5, the active step).** `ApprovalsController@index`
+ `approvals.index` route + `resources/js/pages/approvals/index.tsx` +
Approve/Forward/Return actions (one shared action component, reused on
`subscriptions/show`) + sidebar entry, with type and office filters. Until §12.4
lands the queue cannot be filtered per user — an office dropdown is the interim.

**12.6 Optional dashboard KPI** — pending-approval count linking to the queue.

**12.7 Deferred / never started.** `approved_by` / `approved_at` metadata on
direct-entry subscriptions (§5) and the `rejected` request status (the constant
exists in `ApprovalRequest` but is never written).

