<?php

namespace App\Http\Controllers;

use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Services\ApprovalChain;
use App\Services\AuditTrail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Office-to-office runtime for approval requests.
 *
 * The index lists the approval queue - requests still travelling the chain -
 * while approve records the office's sign-off without moving the pointer,
 * forward hands the request to the next active office in the snapshot and
 * return stops the chain. Approving the final effective step completes the
 * chain and applies its outcome (see ApprovalChain::complete).
 */
class ApprovalRequestController extends Controller
{
    /**
     * The approval queue, optionally narrowed by status, type or office.
     *
     * Office scoping is not tied to the acting user yet (users carry no office),
     * so the office filter is picked by hand for now.
     */
    public function index(Request $request): Response
    {

        $status = $request->filled('status') && $request->status !== 'all'
            ? $request->status
            : ApprovalRequest::STATUS_IN_PROGRESS;

        $requests = ApprovalRequest::query()
            ->with([
                'subscription.office',
                'subscription.owner',
                'flow',
                'currentOffice',
                'renewal',
                'steps.office',
                'steps.actor',
            ])
            ->where('status', $status)
            ->when(
                $request->filled('type') && $request->type !== 'all',
                fn (Builder $query) => $query->where('type', $request->type)
            )
            ->when(
                $request->filled('office_id') && $request->office_id !== 'all',
                fn (Builder $query) => $query->where('current_office_id', $request->office_id)
            )
            ->oldest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('approvals/index', [
            'requests' => $requests,
            'offices' => Office::ordered()->get(['id', 'name']),
            'filters' => $request->only(['status', 'type', 'office_id']),
            'counts' => [
                'in_progress' => ApprovalRequest::query()
                    ->where('status', ApprovalRequest::STATUS_IN_PROGRESS)
                    ->count(),
                'completed' => ApprovalRequest::query()
                    ->where('status', ApprovalRequest::STATUS_COMPLETED)
                    ->count(),
                'returned' => ApprovalRequest::query()
                    ->where('status', ApprovalRequest::STATUS_RETURNED)
                    ->count(),
            ],
        ]);
    }

    /**
     * Record the current office's approval without moving the pointer.
     */
    public function approve(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $validated = $request->validate([
            'remarks' => ['nullable', 'string'],
        ]);

        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        abort_if(
            in_array($step->status, [
                ApprovalRequestStep::STATUS_APPROVED,
                ApprovalRequestStep::STATUS_FORWARDED,
                ApprovalRequestStep::STATUS_RETURNED,
            ], true),
            422,
            'This step has already been actioned.'
        );

        $completesChain = $this->nextActiveStep($approvalRequest, $step) === null;

        DB::transaction(function () use ($approvalRequest, $step, $validated, $request, $completesChain): void {
            $previousStatus = $step->status;

            $step->update([
                'status' => ApprovalRequestStep::STATUS_APPROVED,
                'acted_by' => $request->user()->id,
                'acted_by_name' => $request->user()->name,
                'acted_at' => now(),
                'remarks' => $validated['remarks'] ?? null,
            ]);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Approved',
                auditable: $approvalRequest->subscription,
                oldValues: ['office' => $step->office->name, 'status' => $previousStatus],
                newValues: ['office' => $step->office->name, 'status' => ApprovalRequestStep::STATUS_APPROVED],
                description: 'Approved step at "'.$step->office->name.'" for "'.$approvalRequest->subscription->name.'"',
            );

            if ($completesChain) {
                ApprovalChain::complete($approvalRequest, $request->user());
            }
        });

        return to_route('subscriptions.show', $approvalRequest->subscription_id)
            ->with('success', $completesChain
                ? 'Final approval recorded. The chain is complete.'
                : 'Approval recorded at '.$step->office->name.'.');
    }

    /**
     * Hand the request to the next snapshot step whose office is still active.
     * Deactivated offices are skipped; their history rows are left untouched.
     */
    public function forward(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $validated = $request->validate([
            'remarks' => ['nullable', 'string'],
        ]);

        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        abort_unless(
            $step->status === ApprovalRequestStep::STATUS_APPROVED,
            422,
            'Approve this step before forwarding it.'
        );

        $nextStep = $this->nextActiveStep($approvalRequest, $step);

        DB::transaction(function () use ($approvalRequest, $step, $nextStep, $validated, $request): void {
            $step->update([
                'status' => ApprovalRequestStep::STATUS_FORWARDED,
                'remarks' => $validated['remarks'] ?? $step->remarks,
            ]);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Forwarded',
                auditable: $approvalRequest->subscription,
                oldValues: ['current_office' => $step->office->name],
                newValues: ['current_office' => $nextStep?->office->name ?? 'Chain completed'],
                description: $nextStep === null
                    ? 'Closed the approval chain for "'.$approvalRequest->subscription->name.'" at "'.$step->office->name.'"'
                    : 'Forwarded approval for "'.$approvalRequest->subscription->name.'" to "'.$nextStep->office->name.'"',
            );

            // The pointer never moves past the final effective step: with no
            // active office left ahead (every remaining office was deactivated
            // mid-flight), the chain ends instead of stranding the request.
            if ($nextStep === null) {
                ApprovalChain::complete($approvalRequest, $request->user());

                return;
            }

            $nextStep->update(['status' => ApprovalRequestStep::STATUS_RECEIVED]);

            $approvalRequest->update(['current_office_id' => $nextStep->office_id]);
        });

        return to_route('subscriptions.show', $approvalRequest->subscription_id)
            ->with('success', $nextStep === null
                ? 'No active office left ahead - the chain is complete.'
                : 'Forwarded to '.$nextStep->office->name.'.');
    }

    /**
     * Send the request back. Remarks explaining the return are mandatory and
     * the chain stops until the requesting office acts again.
     */
    public function return(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $validated = $request->validate([
            'remarks' => ['required', 'string'],
        ]);

        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        DB::transaction(function () use ($approvalRequest, $step, $validated, $request): void {
            $previousStatus = $step->status;

            $step->update([
                'status' => ApprovalRequestStep::STATUS_RETURNED,
                'acted_by' => $request->user()->id,
                'acted_by_name' => $request->user()->name,
                'acted_at' => now(),
                'remarks' => $validated['remarks'],
            ]);

            // The request itself is closed as returned so the queue's returned
            // tab and counts can see it without walking the steps.
            $approvalRequest->update([
                'status' => ApprovalRequest::STATUS_RETURNED,
                'remarks' => $validated['remarks'],
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Returned',
                auditable: $approvalRequest->subscription,
                oldValues: ['step_status' => $previousStatus, 'office' => $step->office->name],
                newValues: [
                    'step_status' => ApprovalRequestStep::STATUS_RETURNED,
                    'office' => $step->office->name,
                    'remarks' => $validated['remarks'],
                ],
                description: 'Returned approval for "'.$approvalRequest->subscription->name.'" at "'.$step->office->name.'"',
            );
        });

        return to_route('subscriptions.show', $approvalRequest->subscription_id)
            ->with('success', 'Approval request returned.');
    }

    /**
     * A request can only be actioned while it is still travelling.
     */
    private function requireInProgress(ApprovalRequest $approvalRequest): void
    {
        abort_unless(
            $approvalRequest->status === ApprovalRequest::STATUS_IN_PROGRESS,
            403,
            'This approval request is no longer in progress.'
        );
    }

    /**
     * The snapshot step currently holding the request.
     */
    private function currentStep(ApprovalRequest $approvalRequest): ApprovalRequestStep
    {
        $step = $approvalRequest->steps()
            ->where('office_id', $approvalRequest->current_office_id)
            ->first();

        abort_if($step === null, 422, 'This approval request is not sitting at an office.');

        return $step;
    }

    /**
     * The next snapshot step whose office is still active, or null when the
     * request is already at the final effective step.
     */
    private function nextActiveStep(ApprovalRequest $approvalRequest, ApprovalRequestStep $step): ?ApprovalRequestStep
    {
        return $approvalRequest->steps()
            ->where('step_order', '>', $step->step_order)
            ->whereHas('office', fn (Builder $query) => $query->where('is_active', true))
            ->first();
    }
}
