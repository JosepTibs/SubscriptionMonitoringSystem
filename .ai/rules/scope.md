# Scope — single-operator (ICT) model

**Applies to:** every file in this repo (`**`). Read this before planning or
editing anything, and before proposing features.

## The operating model

This system is the **ICT department's own** subscription register. ICT staff are
the **only** users.

- Other offices **never log in, never confirm anything, and get no accounts.**
- `Office` rows are a **reference list of waypoint offices** (Budget, Accounting,
  Head, …) used to describe where papers physically travel. An office is a
  *destination*, not a participant.
- An approval request/chain is ICT's **log of the papers' physical route**, not a
  multi-user approval workflow.
- `approval_requests.current_office_id` means "the papers are currently with this
  office". It is a **location**, not an access boundary.

## Rules

1. **Never derive `Received by` / `Approved by` from the logged-in user's name.**
   Those names belong to people who have no account; using the ICT encoder's name
   misattributes the approval. They are always **typed** values.
2. **Received by** = the contact person at that office who received the papers, so
   ICT knows who to follow up with while the step is pending.
   **Approved by** = the person who approved — usually the **office head** —
   whose approval is what permits forwarding.
3. `acted_by` (FK → `users`) records **the ICT staff account that encoded the
   entry**. Keep it distinct from the typed names.
4. Do **not** add office-scoped authorization, "my office" queues, per-office
   permissions, or receipt confirmation by other offices.
5. Do **not** add notifications/email addressed to other offices.
6. Keep all data entry with ICT. Any feature that requires another office to *do*
   something in the system is out of scope by definition.

## Retractions

`docs/approval-flows-implementation-plan.md` §11.1 (office-scoped authorization)
and §12.4 (`users.office_id` + "my office" queue) are **not required by design**.
Do not implement them; confirm with the user first if you are asked to.
