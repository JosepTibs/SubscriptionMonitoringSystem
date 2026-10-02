<?php

namespace App\Http\Controllers;

use App\Models\ApprovalRequestStep;
use App\Services\AuditTrail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Administrative corrections to an approval trail.
 *
 * The runtime stamps every date itself and only ever moves a step forward, so
 * the trail is a faithful log of what ICT recorded. Transcription mistakes
 * still happen - a name spelled wrong, a hand-off dated on the wrong day - and
 * this is the single, audited place allowed to fix them.
 *
 * A step's status is never written here: only approve/forward/return may move
 * the papers, so inline editing can never invent an impossible chain state.
 */
class ApprovalRequestStepController extends Controller
{
    /**
     * Correct the recorded values of one trail row.
     */
    public function update(Request $request, ApprovalRequestStep $approvalRequestStep): RedirectResponse
    {
        $this->requireTrailEditor($request);

        $step = $approvalRequestStep->load('office', 'approvalRequest.subscription');

        $validated = $request->validate($this->rules());

        $this->assertChronology($validated);

        $oldValues = $this->snapshot($step);

        DB::transaction(function () use ($step, $validated, $oldValues, $request): void {
            $step->update($validated);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Trail Corrected',
                auditable: $step->approvalRequest->subscription,
                oldValues: $oldValues,
                newValues: $this->snapshot($step->refresh()),
                description: 'Corrected the trail row at "'.$step->office?->name.'" for "'.$step->approvalRequest->subscription->name.'"',
            );
        });

        return back()->with('success', 'Trail entry corrected.');
    }

    /**
     * Erase a row that never happened - a step that was never actioned and is
     * not the one currently holding the papers, so the chain keeps its shape.
     */
    public function destroy(Request $request, ApprovalRequestStep $approvalRequestStep): RedirectResponse
    {
        $this->requireTrailEditor($request);

        $step = $approvalRequestStep->load('office', 'approvalRequest.subscription');

        abort_if(
            $step->status !== ApprovalRequestStep::STATUS_PENDING,
            422,
            'Only a step that has not been actioned can be erased.'
        );

        abort_if(
            $step->approvalRequest->current_office_id === $step->office_id,
            422,
            'The papers are with this office - forward them before erasing its row.'
        );

        DB::transaction(function () use ($step, $request): void {
            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Step Erased',
                auditable: $step->approvalRequest->subscription,
                oldValues: $this->snapshot($step),
                newValues: null,
                description: 'Erased the trail row at "'.$step->office?->name.'" for "'.$step->approvalRequest->subscription->name.'"',
            );

            $step->delete();
        });

        return back()->with('success', 'Trail row erased.');
    }

    /**
     * Dates may be corrected but never invented: the row still has to read in
     * the order the papers travelled.
     *
     * @param  array<string, mixed>  $validated
     */
    private function assertChronology(array $validated): void
    {
        $received = $validated['received_at'] ?? null;
        $approved = $validated['acted_at'] ?? null;
        $sent = $validated['forwarded_at'] ?? null;

        if ($received !== null && $approved !== null && $approved < $received) {
            throw ValidationException::withMessages([
                'acted_at' => 'The approval date cannot be earlier than the date received.',
            ]);
        }

        if ($approved !== null && $sent !== null && $sent < $approved) {
            throw ValidationException::withMessages([
                'forwarded_at' => 'The date sent cannot be earlier than the approval date.',
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            'received_by_name' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date', 'before_or_equal:today'],
            'approved_by_name' => ['nullable', 'string', 'max:255'],
            'acted_at' => ['nullable', 'date', 'before_or_equal:today'],
            'forwarded_by_name' => ['nullable', 'string', 'max:255'],
            'forwarded_at' => ['nullable', 'date', 'before_or_equal:today'],
        ];
    }

    /**
     * The auditable shape of a trail row, used for the before/after diff.
     *
     * @return array<string, mixed>
     */
    private function snapshot(ApprovalRequestStep $step): array
    {
        return [
            'office' => $step->office?->name,
            'received_by' => $step->received_by_name,
            'received_at' => $step->received_at?->toDateTimeString(),
            'approved_by' => $step->approved_by_name,
            'acted_at' => $step->acted_at?->toDateTimeString(),
            'sent_by' => $step->forwarded_by_name,
            'forwarded_at' => $step->forwarded_at?->toDateTimeString(),
        ];
    }

    /**
     * Rewriting a recorded entry is an administrative act: the regular ICT
     * encoder fills the trail but does not rewrite what an office answered for.
     */
    private function requireTrailEditor(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user !== null && ($user->hasRole('admin') || $user->hasRole('superadmin')),
            403,
            'Only an administrator can correct a recorded trail entry.'
        );
    }
}
