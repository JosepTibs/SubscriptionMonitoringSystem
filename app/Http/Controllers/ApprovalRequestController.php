<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Subscription;
use App\Models\Office;
use App\Models\Owner;
use App\Services\ApprovalChain;
use App\Services\AuditTrail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Office-to-office runtime for approval requests.
 *
 * The index lists the approval queue - requests still travelling the chain -
 * while receive and approve record who received the papers and who signed off
 * at the office holding them, forward releases them to the next active office
 * in the snapshot and return stops the chain. Every date is stamped by the
 * service as a name is saved - never typed - and no name is ever derived from
 * the acting account (PRD §0). Approving the final effective step completes the
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

        $show = $request->input('show', 'active');

        $request_count = Subscription::query()->where('status', 'pending_approval')->count();
        $requests = ApprovalRequest::query()
            ->when($show === 'archived', fn (Builder $query) => $query->archived(), fn (Builder $query) => $query->notArchived())
            ->with([
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
            'request_count' => $request_count,
            'requests' => $requests,
            'offices' => Office::ordered()->get(['id', 'name']),
            // Feeds the office select inside the create sheet. The other two
            // are the remaining option sets the shared form needs.
            'owners' => Owner::query()->orderBy('name')->get(),
            'approval_flows' => ApprovalFlow::query()->orderBy('name')->get(),
            'filters' => [...$request->only(['status', 'type', 'office_id']), 'show' => $show],
            'counts' => [
                'in_progress' => ApprovalRequest::query()
                    ->notArchived()
                    ->where('status', ApprovalRequest::STATUS_IN_PROGRESS)
                    ->count(),
                'completed' => ApprovalRequest::query()
                    ->notArchived()
                    ->where('status', ApprovalRequest::STATUS_COMPLETED)
                    ->count(),
                'returned' => ApprovalRequest::query()
                    ->notArchived()
                    ->where('status', ApprovalRequest::STATUS_RETURNED)
                    ->count(),
            ],
        ]);

    }

    /**
     * Intake a subscription that still has to travel an approval chain.
     *
     * The form lives with the queue it feeds, and it deliberately asks for no
     * dates: a submission that has not cleared its chain has none yet.
     */
    public function create(): Response
    {
        return Inertia::render('approvals/create', [
            'offices' => Office::query()->orderBy('name')->get(),
            'owners' => Owner::query()->orderBy('name')->get(),
            'approval_flows' => ApprovalFlow::query()->orderBy('name')->get(),
        ]);
    }

    /**
     * Record the office's approval without moving the pointer.
     *
     * The approval date is stamped the first time the name is saved, so a later
     * spelling correction cannot move it. Approving the final effective step
     * completes the chain and applies its outcome (see ApprovalChain::complete).
     */
    public function approve(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        // The guard runs before validation so acting on a decided request is
        // always a 403, regardless of the payload.
        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        $this->requirePapersHere($approvalRequest, $step);

        abort_if(
            in_array($step->status, [
                ApprovalRequestStep::STATUS_FORWARDED,
                ApprovalRequestStep::STATUS_RETURNED,
            ], true),
            422,
            'This step has already left the office.'
        );

        $validated = $request->validate([
            'approved_by_name' => ['required', 'string', 'max:255'],
        ]);

        $completesChain = $this->nextActiveStep($approvalRequest, $step) === null;

        DB::transaction(function () use ($approvalRequest, $step, $validated, $request, $completesChain): void {
            $previousStatus = $step->status;

            ApprovalChain::markApproved($step, $validated['approved_by_name'], $request->user());

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Approved',
                auditable: $approvalRequest->subscription,
                oldValues: ['office' => $step->office->name, 'status' => $previousStatus],
                newValues: [
                    'office' => $step->office->name,
                    'status' => ApprovalRequestStep::STATUS_APPROVED,
                    'approved_by' => $validated['approved_by_name'],
                ],
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
     * Record the contact who received the papers at the office holding them.
     *
     * The date received is stamped by the server the moment the name is saved
     * (see ApprovalChain::markReceived): it is never typed, and never taken from
     * the acting account (PRD §0).
     */
    public function receive(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        $this->requirePapersHere($approvalRequest, $step);

        $validated = $request->validate([
            'received_by_name' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($approvalRequest, $step, $validated, $request): void {
            $previous = [
                'office' => $step->office->name,
                'received_by' => $step->received_by_name,
                'received_at' => $step->received_at?->toDateTimeString(),
            ];

            ApprovalChain::markReceived($step, $validated['received_by_name']);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Received',
                auditable: $approvalRequest->subscription,
                oldValues: $previous,
                newValues: [
                    'office' => $step->office->name,
                    'received_by' => $validated['received_by_name'],
                    'received_at' => $step->refresh()->received_at?->toDateTimeString(),
                ],
                description: 'Recorded the receiver at "'.$step->office->name.'" for "'.$approvalRequest->subscription->name.'"',
            );
        });

        return to_route('subscriptions.show', $approvalRequest->subscription_id)
            ->with('success', 'Receiver recorded at '.$step->office->name.'.');
    }

    /**
     * Release the papers from the office holding them.
     *
     * Naming the sender is the release: the release date is stamped here (see
     * ApprovalChain::markReleased) and the pointer moves on to the next active
     * office. Deactivated offices are skipped; their history rows are left
     * untouched. The destination's own receiver is recorded when the papers are
     * typed in there, so nothing is stamped ahead of the hand-off.
     */
    public function forward(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $this->requireInProgress($approvalRequest);

        $step = $this->currentStep($approvalRequest);

        $this->requirePapersHere($approvalRequest, $step);

        abort_unless(
            $step->status === ApprovalRequestStep::STATUS_APPROVED,
            422,
            'Approve this step before releasing the papers.'
        );

        $nextStep = $this->nextActiveStep($approvalRequest, $step);

        $validated = $request->validate([
            // The person releasing the papers from this office, typed by ICT
            // (PRD §0 - never the acting account's name). Optional in the API so
            // a release can still be recorded when nobody was named; the trail
            // then falls back to the step's signatory.
            'sent_by_name' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($approvalRequest, $step, $nextStep, $validated, $request): void {
            ApprovalChain::markReleased($step, $validated['sent_by_name'] ?? null);

            AuditTrail::record(
                user: $request->user(),
                action: 'Approval Forwarded',
                auditable: $approvalRequest->subscription,
                oldValues: ['current_office' => $step->office->name],
                newValues: [
                    'current_office' => $nextStep?->office->name ?? 'Chain completed',
                    'sent_by' => $validated['sent_by_name'] ?? $step->approved_by_name,
                ],
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

            $approvalRequest->update(['current_office_id' => $nextStep->office_id]);
        });

        return to_route('subscriptions.show', $approvalRequest->subscription_id)
            ->with('success', $nextStep === null
                ? 'No active office left ahead - the chain is complete.'
                : 'Forwarded to '.$nextStep->office->name.'.');
    }

    /**
     * Send the request back: the chain stops until the requesting office acts
     * again.
     */
    public function return(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        // The guard runs before validation so acting on a decided request is
        // always a 403, regardless of the payload.
        $this->requireInProgress($approvalRequest);

        $validated = $request->validate([
            // The office's decision-maker who sent it back, typed by ICT
            // (PRD §0). Same column as approve; the trail labels it "Returned by".
            'approved_by_name' => ['required', 'string', 'max:255'],
        ]);

        $step = $this->currentStep($approvalRequest);

        DB::transaction(function () use ($approvalRequest, $step, $validated, $request): void {
            $previousStatus = $step->status;

            $step->update([
                'status' => ApprovalRequestStep::STATUS_RETURNED,
                'acted_by' => $request->user()->id,
                'approved_by_name' => $validated['approved_by_name'],
                'acted_at' => now(),
            ]);

            // The request itself is closed as returned so the queue's returned
            // tab and counts can see it without walking the steps.
            $approvalRequest->update([
                'status' => ApprovalRequest::STATUS_RETURNED,
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
                    'returned_by' => $validated['approved_by_name'],
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
     * Archiving and deleting chains is an administrative act: the regular ICT
     * encoder moves papers but never hides or erases a recorded chain.
     */
    private function requireChainManager(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user !== null && ($user->hasRole('admin') || $user->hasRole('superadmin')),
            403,
            'Only an administrator can archive or delete an approval request.'
        );
    }

    /**
     * Hide a chain from the normal queue without deleting it.
     */
    public function archive(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $this->requireChainManager($request);

        $approvalRequest->archive();

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Archived',
            auditable: $approvalRequest->subscription,
            newValues: ['approval_request_id' => $approvalRequest->id],
            description: 'Archived approval request #'.$approvalRequest->id.' for "'.$approvalRequest->subscription->name.'"',
        );

        return back()->with('success', 'Approval request archived.');
    }

    /**
     * Show an archived chain in the normal queue again.
     */
    public function unarchive(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $this->requireChainManager($request);

        $approvalRequest->unarchive();

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Unarchived',
            auditable: $approvalRequest->subscription,
            newValues: ['approval_request_id' => $approvalRequest->id],
            description: 'Unarchived approval request #'.$approvalRequest->id.' for "'.$approvalRequest->subscription->name.'"',
        );

        return back()->with('success', 'Approval request unarchived.');
    }

    /**
     * Permanently erase a finished chain and its snapshot steps. A live chain
     * can only be archived — deleting it would orphan papers in transit.
     */
    public function destroy(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $this->requireChainManager($request);

        abort_if(
            $approvalRequest->status === ApprovalRequest::STATUS_IN_PROGRESS,
            422,
            'Only a finished approval request can be deleted. Archive it while it is still travelling.'
        );

        $subscription = $approvalRequest->subscription;

        $approvalRequest->delete();

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Deleted',
            auditable: $subscription,
            oldValues: ['approval_request_id' => $approvalRequest->id],
            description: 'Deleted approval request #'.$approvalRequest->id.' for "'.$subscription->name.'"',
        );

        return back()->with('success', 'Approval request deleted permanently.');
    }

    /**
     * Only the row the papers have actually reached may be written to: every
     * office ahead of it - ignoring deactivated offices, which the runtime skips
     * - must already have released the papers. The trail table uses the same
     * rule to decide which row offers inputs.
     */
    private function requirePapersHere(ApprovalRequest $approvalRequest, ApprovalRequestStep $step): void
    {
        $waiting = $approvalRequest->steps()
            ->where('step_order', '<', $step->step_order)
            ->where('status', '!=', ApprovalRequestStep::STATUS_FORWARDED)
            ->whereHas('office', fn (Builder $query) => $query->where('is_active', true))
            ->exists();

        abort_if($waiting, 422, 'An earlier office has not released the papers yet.');
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
