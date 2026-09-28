# Implementation Plan — Received by / Approved by (typed signatories per step)

> **Status: ✅ SHIPPED 2026-09-24 — all five capture points landed (§2–§7).**
> §0 carries the per-piece state. Written 2026-09-24.
>
> Companion to `docs/approval-flows-implementation-plan.md` (whose §0 is the
> milestone source of truth) and to `PRD.md` **§0 Scope & Operating Model**,
> which is the authority on who may operate this system. Read PRD §0 first: the
> names below belong to people who have **no accounts**, so they are typed by
> ICT and must never be derived from the logged-in user.
>
> Stack: Laravel 12 + PHP 8.2 + Inertia 3 + React 19 + Tailwind 4/shadcn.
> Conventions follow `ApprovalRequestController` / `SubscriptionController`
> (validate → act → `AuditTrail::record` → redirect with flash).

---

## 0. Status at a glance

The feature is **shipped**. This is where each piece landed:

| Piece of this plan | State | Evidence |
| --- | --- | --- |
| Migration + schema | ✅ **Done 2026-09-24** | `2026_09_24_132220_add_received_and_approved_by_to_approval_request_steps_table` — `received_by_name`, `received_at`, `acted_by_name` → `approved_by_name` rename; ran on MySQL **and** sqlite; up/down proven by rollback/re-migrate; legacy value nulled, **no backfill** (§2.3 amended) |
| Model `$fillable`/`casts` | ✅ Done 2026-09-24 | `approved_by_name`, `received_by_name`, `received_at` fillable; `received_at` cast to datetime |
| Capture points 1–2 (intake/renewal) | ✅ **Done 2026-09-24** | `ApprovalChain::start(..., ?string $receivedByName)` stamps step 1 `received`; `SubscriptionController::store` validates `required_if:intake_mode,for_approval`, `RenewalsController::store` `required_unless:decision,cancelled`; both audit `received_by` |
| Capture points 3–5 (approve/return/forward) | ✅ **Done 2026-09-24** | `approve`/`return` require `approved_by_name`, `forward` requires `received_by_name` only when a destination exists (`Rule::requiredIf($nextStep !== null)`); the encoder's `user()->name` writes are **gone**; `AuditTrail` `newValues` carry `approved_by`/`returned_by`/`received_by`; guards now run **before** validation so decided-request actions stay 403 |
| Dialog inputs for the names | ✅ **Done 2026-09-24** | `approval-actions.tsx`: per-action input (Approved by / Received by / Returned by) + **real field errors** surfaced (the generic message is now only a fallback) |
| Entry forms | ✅ **Done 2026-09-24** | `subscription-form.tsx` `showReceivedBy` (gated on for_approval in `create.tsx`); `renewal-review-sheet.tsx` receiver input (required unless decision = cancelled) |
| Trail labels + aging | ✅ **Done 2026-09-24** | `renewal-timeline.tsx`: Received by / Approved by / Returned by per state, `actor?.name` fallback for legacy rows, "At this office N day(s)" from `received_at` on the current step |
| Types / tests | ✅ **Done 2026-09-24** | `types/index.ts` (`approved_by_name`, `received_by_name`, `received_at`); every action PATCH carries its typed name (~16 sites across `ApprovalChainTest`/`RenewalApprovalTest`); new tests: receiver on intake + renewal, destination stamp, conditional-required forward, signatory survives account deletion, 422 without a name; `tsc --noEmit` clean |

> **Amendment to §2.3/§10.3 (2026-09-24):** the previously recommended backfill
> is **dropped**. The only name available for legacy rows is the ICT encoder's —
> writing it into `approved_by_name` recreates the misattribution PRD §0
> forbids. Legacy values are nulled instead; the trail falls back to
> `actor?.name` for those rows. (Effectively moot: the dev database was
> re-seeded via `migrate:fresh` before implementation, so no legacy rows
> remain.)

**Final verification (2026-09-24):** full suite **86 passed / 516 assertions**
(69 s, detached), `npm run build` ✓ (1 m 15 s), `vendor/bin/pint --dirty`
passed, `tsc --noEmit` exit 0, prettier applied to every touched frontend file.

## 1. Requirement & vocabulary

The requirement is a **contact list plus an approval record**, filled in by ICT
at each hand-off. Three different people are involved and only one of them is a
system user:

| Actor | Who they are | How it is stored |
| --- | --- | --- |
| **ICT encoder** | ICT staffer who performs the action in the app. The only person with a login. | `acted_by` (FK → `users`, `nullOnDelete`) + `acted_at` |
| **Received by** | The contact person at the destination office who took the papers. Exists so ICT knows **who to follow up with** while the step is pending. | `received_by_name` (typed) + `received_at` |
| **Approved by** | Usually the **office head**. Their approval is what permits forwarding. | `approved_by_name` (typed) |

Two defects this change fixes:

1. **Misattribution.** `approve`/`return` snapshot the *logged-in ICT user's*
   name into the name column, so the trail credits the encoder for somebody
   else's approval — the exact anti-pattern PRD §0 forbids. The typed value
   replaces it; `acted_by` keeps the encoder for accountability.
2. **The "Waiting" bug.** `forward()` never names the receiving office (`:186`),
   so an approved-and-forwarded step renders **"Waiting"**
   (`renewal-timeline.tsx:76`) even though the papers are already there.

Vocabulary note: `acted_by_name` is **renamed** to `approved_by_name`, not
duplicated. One column, one meaning — the office's decision-maker.

---

## 2. Data model change

### 2.1 New migration

`add_received_and_approved_by_to_approval_request_steps`, mirroring the style of
`2026_09_23_152833_add_acted_by_name_to_approval_request_steps.php` (ordered
columns, documented intent, reversible `down()`).

```php
public function up(): void
{
    Schema::table('approval_request_steps', function (Blueprint $table) {
        // The receiving office's contact person, typed by ICT at hand-off.
        $table->string('received_by_name')->nullable()->after('acted_at');
        $table->timestamp('received_at')->nullable()->after('received_by_name');

        // acted_by_name held the acting *account's* name; the signatory is a
        // different person who has no account, so the column is renamed to
        // match what it now means.
        $table->renameColumn('acted_by_name', 'approved_by_name');
    });

    // The legacy value was written under the old semantics (the encoder's
    // name), so it must not survive the rename as a false approval record.
    DB::table('approval_request_steps')->update(['approved_by_name' => null]);
}
```

`down()` renames the column back and drops the two new ones.

> **Verify before writing:** native `renameColumn` support on sqlite (the test
> suite runs `:memory:` sqlite). Laravel 12 handles it, but if the suite rejects
> it, fall back to **add + copy + drop** in three statements — portable on every
> driver.

### 2.2 Model

`app/Models/ApprovalRequestStep.php`:

- `$fillable` (lines 25–34): drop `acted_by_name`, add `approved_by_name`,
  `received_by_name`, `received_at`.
- `casts()` (51–57): add `'received_at' => 'datetime'`.
- Relations stay as built (`actor()`, `office()`, `approvalRequest()`).

### 2.3 Legacy value + backfill

Three separate concerns, all in this migration:

1. **Null the misleading value.** Exactly one row holds a name written under the
   old semantics (the ICT encoder's). After the rename it would read as an
   officer's approval, which is false — so null it and let the trail fall back
   to `actor?.name` for that row (§6.2).
2. **Backfill the encoder's name where known.** The 4 rows with `acted_by` set
   can be named from `users`, walking `chunkById` and building the name exactly
   like `User::getNameAttribute()` (`collect([fname, mname, lname, sname])
   ->filter()->implode(' ')`), so a since-deleted user's row stays legible.
   Prefer PHP over `CONCAT_WS` for portability across MySQL (dev) and sqlite
   (tests). **Recommended, confirm in §10.**
3. **`received_at` for historical rows stays `null`** — nothing can invent when
   the papers actually arrived. Legacy rows simply show no received-by.

`down()` cannot restore values it dropped; note in the docblock that a rollback
loses the backfilled names. Acceptable: the `audit_logs` rows retain the same
history.

---

## 3. Capture points (every one filled in by ICT)

| Moment                                             | Field written                   | Step it lands on                   | Where                                                             |
| ---                                                | ---                             |              ---                   |   ---                                                             |
| Submit for approval (`intake_mode = for_approval`) | **Received by** + `received_at` | first snapshot step                | `SubscriptionController::createProcurementRequest()` (`:255–257`) |
| Record a renewal decision                          | **Received by** + `received_at` | first step of the renewal chain    | `RenewalsController::openRenewalRequest()` (`:90–114`, start at `:92`) |
| **Approve** dialog                                 | **Approved by** (+ remarks)     | the current step                   | `ApprovalRequestController::approve()` (`:110–116`)               |
| **Return** dialog                                  | **Returned by** → same column   | the current step                   | `ApprovalRequestController::return()` (`:214–220`)                |
| **Forward** dialog                                 | **Received by** + `received_at` |for the *destination*               | the **next** step `ApprovalRequestController::forward()` (`:186`) |

Validation (all three actions): the name is a `string`, `max:255`. Whether it is
**required** is decided in §10 — the recommendation is required on intake and
forward, and on approve/return.

---

## 4. Service change — `ApprovalChain::start()`

`app/Services/ApprovalChain.php:44–76` currently creates every snapshot step as
`STATUS_PENDING` (`:70`) and never records a receiver.

```php
public static function start(
    Subscription $subscription,
    ApprovalFlow $flow,
    string $type,
    ?Renewal $renewal = null,
    ?string $receivedByName = null,   // new
): ApprovalRequest
```

Inside the loop, the **first** step additionally gets:

- `status => ApprovalRequestStep::STATUS_RECEIVED` (it is already "with" that
  office — consistent with `forward()`, which stamps the destination
  `received`)
- `received_by_name => $receivedByName`
- `received_at => now()`

### 4.1 Consequence for existing tests (see §7.2)

Flipping step 1 from `pending` to `received` is *semantically* correct and the
UI is unaffected (`trailStepState()` treats both as `current`, and
`approval-actions.tsx` allows approve from `pending` **or** `received`), but it
does change assertions that expect `pending`. If the churn is unwanted, the
alternative is to keep step 1 `pending` and only record the name/timestamp —
which still fixes the "Waiting" bug because the label reads the name, not the
status. **Recommend flipping**, because a step sitting at an office should not
claim to be unreached.

---

## 5. Controller change — `ApprovalRequestController`

### 5.1 `approve()` (validate `:87–89`, write `:110–116`)

- Add `'approved_by_name' => ['required', 'string', 'max:255']` to the
  validation.
- Replace `'acted_by_name' => $request->user()->name` (`:113`) with
  `'approved_by_name' => $validated['approved_by_name']`. Keep `acted_by`/
  `acted_at`.
- Extend the audit `newValues` (`:123`) with `'approved_by' => $validated['approved_by_name']`.

### 5.2 `forward()` (validate `:144–146`, hand-off `:186`)

- Add `'received_by_name' => ['required', 'string', 'max:255']` (name of the
  contact receiving the papers at the destination).
- At `:186`, alongside `status => RECEIVED`, write
  `received_by_name` + `received_at => now()`.
- Extend the audit `newValues` (`:171`) with `'received_by' => $validated['received_by_name']`.
- Edge case: when `$nextStep === null` (`:180–184`) there is no destination to
  receive anything — the chain completes instead, so the field is only required
  when a next step exists. Validate conditionally, or accept it and ignore it.

### 5.3 `return()` (validate `:203–205`, write `:214–220`)

- Add `'approved_by_name' => ['required', 'string', 'max:255']` — reuse the same
  column as approve, since the returner is the office's decision-maker. The
  trail labels it "Returned by" (§6.2).
- Replace `'acted_by_name' => $request->user()->name` (`:217`).
- Extend the audit `newValues` (`:236–240`) with `'returned_by' => $validated['approved_by_name']`.

> Note `return()` also closes the *request* (`:224–229`, request-level status,
> remarks, `decided_by`, `decided_at`) — that behaviour was lost in `MVP 3.0` and
> restored on 2026-09-24. Do not disturb it.

---

## 6. UI changes

### 6.1 Action dialog — `resources/js/components/approval-actions.tsx`

- Add state for the typed name next to `remarks` (`:23`) and send it in the PATCH
  payload (`:53`): `{ remarks, received_by_name }` for forward,
  `{ remarks, approved_by_name }` for approve/return.
- Render the matching `<Input>` above the remarks textarea (`:83–93`), with a
  `Label` and an `InputError` bound to **that field's** message.
- **Fix the swallowed error** (`:55`): today any failure shows the generic
  `'Unable to record this action.'`, so a validation message never reaches the
  user. Bind `errors` from `useForm`/`router.patch` to the field (and keep the
  generic string only as a fallback), so "The approved by field is required."
  is visible.
- Copy (`:13–17`): mention whose name is being captured, e.g. approve →
  "Name the office head who approved"; forward → "Name the contact receiving the
  papers at the next office".

### 6.2 Trail labels — `resources/js/components/renewal-timeline.tsx`

Replace the single `actorName` (`:58`) / label (`:76`) with status-aware labels:

| Step status | Label |
| --- | --- |
| `pending` | `Received by <received_by_name>` — or "No contact recorded" |
| `received` | `Received by <received_by_name>` |
| `approved` | `Approved by <approved_by_name>` |
| `forwarded` | `Approved by <approved_by_name>` |
| `returned` | `Returned by <approved_by_name>` |

Keep the legacy fallback: when the typed name is missing, fall back to
`step.actor?.name` (which is how the one pre-existing row stays legible), and
only then show "Waiting". Optional but recommended: an **aging** line derived
from `received_at` ("at this office 12 days"), since this screen tracks physical
movement — reuse the existing `formatDate` helper style rather than adding a
dependency.

### 6.3 Stepper — `resources/js/components/approval-stepper.tsx`

The compact stepper renders office names in a chip row (`:79–83`) and derives
state from `trailStepState()` (`:21–35`); it shows no names today, so nothing
*breaks*. Leave it as-is, or add the approved-by name to the chip's `title`
attribute for a hover tooltip. Its `trailStepState` mapping already covers
`received` → `current` (`:30`) and `approved`/`forwarded` → `done` (`:26`), so no
change is required there.

### 6.4 Intake + renewal forms (the "Received by" entry points)

- `resources/js/pages/subscriptions/partials/subscription-form.tsx`: when
  `intake_mode === 'for_approval'`, show a **Received by** input (required) —
  the first office that receives the papers.
- `resources/js/components/renewal-review-sheet.tsx` (`useForm` at `:29–34`):
  add `received_by_name` to the form state and the payload, shown for the
  `renewed`/`pending` decisions (the ones that travel the chain). The sheet's
  copy at `:54–57` already explains that these decisions travel the chain.
- Both controllers add the field to their validation payloads:
  `SubscriptionController::store` (`intake_mode` branch) and
  `RenewalsController::store` (`:29–34`, feeding `openRenewalRequest`).

---

## 7. Types and tests

### 7.1 Types — `resources/js/types/index.ts`

`ApprovalRequestStep` (`:58–70`): replace `acted_by_name` (`:65`) with
`approved_by_name: string | null`, and add `received_by_name: string | null` and
`received_at: string | null`. `ApprovalRequestStepStatus` (`:56`) already
includes `received`, so no change there.

### 7.2 Tests that must change (verified)

| File | Line | Why it breaks |
| --- | --- | --- |
| `tests/Feature/ApprovalChainTest.php` | `67`, `94`, `237` | assert `acted_by_name === $user->name` — the value is now the typed name |
| `tests/Feature/ApprovalChainTest.php` | `106` | asserts step 1 is `STATUS_PENDING` — becomes `received` (§4.1) |
| `tests/Feature/SubscriptionIntakeTest.php` | `91` | asserts **every** step is `PENDING` — step 1 changes |

Not affected: `ApprovalChainTest` `:123–124`, `:144–145`, `:191`, `:214` (they
assert later steps, which keep `received`/`pending` as forwarding dictates);
`SubscriptionApprovalTrailTest:89` (step 3); fixtures in
`ApprovalsQueueTest:28` and `SubscriptionApprovalTrailTest:51`.

### 7.3 New tests to add

Extend the existing files rather than adding new ones (house convention):

- `SubscriptionIntakeTest` — submitting for approval records step 1 as
  `received` with the typed `received_by_name` + a non-null `received_at`, and
  the name is **not** the acting user's.
- `RenewalApprovalTest` — same capture on the renewal path.
- `ApprovalChainTest` — approve stores the typed `approved_by_name` (and does
  **not** store the encoder's name); return stores it too; forward stamps the
  **destination** step with `received_by_name` + `received_at` (this is the
  regression test for the "Waiting" bug).
- Validation: approve/forward/return without the name → 422 with the field
  error; the intake path likewise.

---

## 8. Edge cases

- **Chain completes on forward** (`forward()`, `:180–184`): there is no
  destination, so a required received-by field must not block the action —
  validate it only when `$nextStep` exists.
- **Deactivated office skipped mid-flight**: the *receiving* office may be a
  different one than the "next" in the original list; the received-by name always
  belongs to whichever step actually becomes current (`$nextStep`), which is
  already what the code decides.
- **A step returns, then is re-approved**: the row is overwritten, so its
  received-by survives while `approved_by_name` is replaced. If a full history of
  repeated decisions is ever needed, that is a separate change (audit rows
  already hold the sequence).
- **Name typo**: there is no directory of approved spellings, so the typed value
  is taken at face value. Normalising/validating against a list of officers is
  explicitly out of scope (§11).
- **Deleted ICT user**: `acted_by` nulls out (`nullOnDelete`) but both typed
  names and `acted_at`/`received_at` remain — that is the point of the snapshot.
- **Renewal decided as `cancelled`**: no chain is opened, so no received-by is
  collected (no office is ever involved).

---

## 9. Build order & definition of done

| # | Step | Done when |
| --- | --- | --- |
| 1 | Migration + model (§2) | `php artisan migrate` runs on the dev DB; `migrate:fresh` green in tests; legacy value nulled and the 4 encoders' names backfilled |
| 2 | `ApprovalChain::start()` (§4) | step 1 is `received` with a name + timestamp |
| 3 | Controller capture + validation (§5) | approve/return/forward store typed names; no `user()->name` writes remain |
| 4 | UI (§6) | dialog asks for the name and shows the real field error; trail labels read Received by / Approved by / Returned by |
| 5 | Types + tests (§7) | updated assertions pass; new tests cover all five capture points |
| 6 | Docs (§12) | PRD §4/§5/§7 flipped to ✅; this doc's §0 flipped to done with the final test count |

Per-change workflow (house rules): `vendor/bin/pint --dirty --format agent`,
targeted test, then the full suite + `npm run build` **detached** (a run is ~20–70 s
and `build` ~80 s, both beyond the 30-second shell limit — see the main plan doc
§12.10 for the recipe).

---

## 10. Open decisions (all resolved 2026-09-24 — implemented as recommended)

1. **Are the names required?** → **Yes**, on all five capture points; the
   forward rule is conditional (no destination = no receiver asked).
2. **Flip step 1 to `received`?** → **Yes, when a receiver name is supplied**
   (so direct `start()` calls in tests keep the legacy `pending` shape).
   `ApprovalChainTest`/`SubscriptionIntakeTest` assertions updated accordingly.
3. **Backfill the 4 encoder names / null the 1 legacy value?** → **Null the
   legacy value, no backfill** (moot after the user's `migrate:fresh`, but the
   migration still nulls on first run).
4. **Contact number/email column?** → **No** — names only, per the
   recommendation.
5. **Show aging from `received_at`?** → **Yes** — "At this office N day(s)" on
   the current step in `renewal-timeline.tsx`.

---

## 11. Deferred / explicitly out of scope

- Officer directory / picklists, spelling normalisation, or linking a name to a
  future user account — the whole point is that these people have no accounts
  (PRD §0).
- Contact number/email fields (decision 4).
- Notifications to the receiving office — other offices are not users.
- Proof-of-receipt artefacts (scans, signatures).
- Full decision history per step (repeated approve/return cycles) — the audit
  trail covers it for now.

---

## 12. Documentation updates this change requires

| Document | Change |
| --- | --- |
| `PRD.md` §4 | `ApprovalRequestStep` finally matches the plan: `received_by_name` + `received_at` + `approved_by_name`, `acted_by` = ICT encoder |
| `PRD.md` §5 / §7 | the "Traceability ⬜" item flips to ✅ once landed |
| `docs/approval-flows-implementation-plan.md` §11.11 | currently describes `acted_by_name` as a snapshot of the acting user — amend it to the two typed names and why |
| `docs/approval-flows-implementation-plan.md` §0 / §12.4 | keep the retraction: office-scoped authorization is not required by design (PRD §0), so this feature is *not* a substitute for `users.office_id` — nobody should reopen it |




