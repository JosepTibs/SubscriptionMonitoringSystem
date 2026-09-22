# Implementation Plan — Approval Flows, Subscription Intake & Renewal Chain

> Companion to `PRD.md`. Covers the generalized approval machinery (procurement
> + renewals), named office flows, and the remaining P2 items.
> Stack: Laravel 12 + Inertia (React) + Tailwind/shadcn. Conventions follow
> `SubscriptionController` / `UserController` (validate → act → `AuditTrail::record`
> → redirect with flash).

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

| Screen | Work |
| --- | --- |
| `subscriptions/create` / `edit` | Intake toggle + flow select |
| `subscriptions/show` | Real trail stepper from `approval_request_steps` — replace `renewal-timeline-mock.tsx` with `RenewalTimeline.tsx` (done / current / todo / returned states, actor + timestamp + remarks) |
| **new** `approvals/index` | Queue: `in_progress` requests at my office (type filter), Approve / Forward / Return actions with remarks |
| **new** `approval-flows/*` | Flows admin CRUD (milestone 1) |
| Dashboard | Optional KPI: pending-approval count + queue link |

Shared component: `resources/js/components/approval-stepper.tsx` — renders the
`----0-----0------0----0` line from a request's steps.

---

## 9. Build order & definition of done

| # | Milestone | Done when |
| --- | --- | --- |
| 1 | Flows CRUD + `subscriptions.approval_flow_id` | CRUD end-to-end, default-flow exclusivity, tests green |
| 2 | Status + two-path intake | Direct vs for-approval creation with snapshot; tests green |
| 3 | Chain runtime | All §6 rules enforced; full coverage; audits written |
| 4 | Renewal wiring | Renewals route through chain; completion applies changes |
| 5 | Queue + real stepper | Office approvers see their queue + live trail; mock removed |
| 6 | Cleanup | Drop `renewal_steps` model/migration + `renewals.current_office_id`; Pint clean; full suite + `npm run build` green |

Per-change workflow: `vendor/bin/pint --dirty --format agent`, feature test for
the change, `npm run build`, full `php artisan test --compact` before moving on.

---

## 10. Edge cases checklist

- [ ] Office deactivated mid-flight → skipped on next forward, history intact
- [ ] Flow edited mid-flight → in-flight snapshots unchanged
- [ ] Flow referenced → protected from delete; only future requests affected
- [ ] No default flow exists → for-approval intake blocked with a helpful
      message; admin must set one first
- [ ] Subscription deleted → requests cascade-delete; audit logs keep history
- [ ] Last-step forward without final approval → blocked
- [ ] `pending_approval` subscriptions excluded from dashboard "active spend"
      and due-soon (verify in `DashboardController`)
