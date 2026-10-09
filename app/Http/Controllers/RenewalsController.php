<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequest;
use App\Models\Renewal;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use App\Services\AuditTrail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RenewalsController extends Controller
{
    /**
     * Record a renewal review decision for a subscription.
     *
     * "renewed" opens a renewal approval request, so the proposed date/cost
     * only reach the subscription when the chain completes
     * (see ApprovalChain::complete). "pending" defers the decision without
     * opening a chain; "cancelled" needs no approval and applies immediately.
     */
    public function store(Request $request, Subscription $subscription): RedirectResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'in:renewed,cancelled,pending'],
            'new_renewal_date' => ['nullable', 'date', 'required_if:decision,renewed'],
            'new_cost' => ['nullable', 'numeric', 'min:0', 'required_if:decision,renewed'],
            'remarks' => ['nullable', 'string'],
        ]);

        // One renewal chain travels at a time: a second proposal while the
        // first is still in flight would race on complete (last-writer-wins
        // on cost/date), so reject it and point at the pending request.
        if ($validated['decision'] === 'renewed' && $this->hasPendingRenewal($subscription)) {
            throw ValidationException::withMessages([
                'decision' => 'A renewal is already travelling the approval chain. Complete or return it before recording another.',
            ]);
        }

        $requiresApproval = $validated['decision'] === 'renewed';
        $flow = $requiresApproval ? ApprovalChain::flowFor($subscription) : null;

        if ($requiresApproval && $flow === null) {
            throw ValidationException::withMessages([
                'decision' => 'No approval flow is configured - ask an administrator to set a default flow first.',
            ]);
        }

        DB::transaction(function () use ($subscription, $validated, $flow, $request): void {
            $renewal = $subscription->renewals()->create([
                'previous_renewal_date' => $subscription->renewal_date,
                'new_renewal_date' => $validated['new_renewal_date'] ?? null,
                'previous_cost' => $subscription->cost,
                'new_cost' => $validated['new_cost'] ?? null,
                'decision' => $validated['decision'],
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'remarks' => $validated['remarks'] ?? null,
            ]);

            if ($flow instanceof ApprovalFlow) {
                $this->openRenewalRequest($subscription, $renewal, $flow, $request->user());

                return;
            }

            // Deferred ("pending") reviews record a note only: no chain is
            // opened and the subscription keeps its status/cost/date.
            if ($validated['decision'] !== 'cancelled') {
                AuditTrail::record(
                    user: $request->user(),
                    action: 'Renewal Deferred',
                    auditable: $subscription,
                    newValues: [
                        'decision' => $renewal->decision,
                        'remarks' => $renewal->remarks,
                    ],
                    description: 'Renewal review for "'.$subscription->name.'" deferred',
                );

                return;
            }

            // Nothing to approve: the cancellation applies straight away.
            $subscription->update(['status' => 'cancelled']);

            AuditTrail::record(
                user: $request->user(),
                action: 'Renewal Reviewed',
                auditable: $subscription,
                oldValues: [
                    'renewal_date' => $renewal->previous_renewal_date?->toDateString(),
                    'cost' => (string) $renewal->previous_cost,
                ],
                newValues: [
                    'decision' => $renewal->decision,
                    'renewal_date' => null,
                    'cost' => null,
                ],
                description: 'Renewal review for "'.$subscription->name.'": '.$renewal->decision,
            );
        });

        return to_route('subscriptions.show', $subscription);
    }

    /**
     * Whether a renewal chain for this subscription is still travelling.
     * Deferred ("pending") reviews open no chain, so only "renewed" rows
     * linked to an in-progress request count.
     */
    private function hasPendingRenewal(Subscription $subscription): bool
    {
        return $subscription->approvalRequests()
            ->where('type', ApprovalRequest::TYPE_RENEWAL)
            ->where('status', ApprovalRequest::STATUS_IN_PROGRESS)
            ->exists();
    }

    /**
     * Open the approval request for a renewal decision, snapshotting the flow's
     * offices so the trail stays immutable even if the flow is edited later.
     */
    private function openRenewalRequest(Subscription $subscription, Renewal $renewal, ApprovalFlow $flow, User $user): ApprovalRequest
    {
        $approvalRequest = ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_RENEWAL, $renewal);
        $approvalRequest->load('currentOffice');

        AuditTrail::record(
            user: $user,
            action: 'Renewal Submitted for Approval',
            auditable: $subscription,
            oldValues: [
                'renewal_date' => $renewal->previous_renewal_date?->toDateString(),
                'cost' => (string) $renewal->previous_cost,
            ],
            newValues: [
                'decision' => $renewal->decision,
                'renewal_date' => $renewal->new_renewal_date?->toDateString(),
                'cost' => $renewal->new_cost,
                'approval_flow' => $flow->name,
                'current_office' => $approvalRequest->currentOffice?->name,
            ],
            description: 'Submitted renewal for "'.$subscription->name.'" for approval via flow "'.$flow->name.'"',
        );

        return $approvalRequest;
    }
}
