<?php

namespace App\Services;

use App\Mail\ApprovalCompletedMail;
use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Renewal;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Shared engine behind every approval chain: procurement intake, renewal
 * reviews and the office-to-office runtime.
 *
 * Requests always work from an immutable snapshot of the flow's steps
 * (approval_request_steps) taken when the request is created, so editing a
 * flow later never rewrites an in-flight trail.
 */
class ApprovalChain
{
    /**
     * Resolve the flow a new request should follow: an explicit choice, the
     * subscription's own flow, then the default flow.
     */
    public static function flowFor(?Subscription $subscription = null, ?int $flowId = null): ?ApprovalFlow
    {
        if ($flowId !== null) {
            return ApprovalFlow::findOrFail($flowId);
        }

        return $subscription?->approvalFlow ?? ApprovalFlow::defaultFlow();
    }

    /**
     * Create a request and snapshot the flow's steps into approval_request_steps.
     *
     * The pointer starts at the first snapshot step whose office is still
     * active, falling back to the first step so a fully deactivated flow still
     * has somewhere to sit. Every row starts pending and empty: the names at
     * each office, and the dates beside them, are typed as the papers travel
     * (see markReceived, markApproved and markReleased), never at submission.
     */
    public static function start(
        Subscription $subscription,
        ApprovalFlow $flow,
        string $type,
        ?Renewal $renewal = null,
    ): ApprovalRequest {
        $flow->load('steps.office');

        $steps = $flow->steps->sortBy('step_order')->values();
        $firstStep = $steps->first(fn (ApprovalFlowStep $step): bool => (bool) $step->office?->is_active) ?? $steps->first();

        return DB::transaction(function () use ($subscription, $flow, $type, $renewal, $steps, $firstStep): ApprovalRequest {
            $request = ApprovalRequest::create([
                'subscription_id' => $subscription->id,
                'type' => $type,
                'renewal_id' => $renewal?->id,
                'approval_flow_id' => $flow->id,
                'current_office_id' => $firstStep?->office_id,
                'status' => ApprovalRequest::STATUS_IN_PROGRESS,
            ]);

            foreach ($steps as $index => $step) {
                ApprovalRequestStep::create([
                    'approval_request_id' => $request->id,
                    'office_id' => $step->office_id,
                    'step_order' => $index + 1,
                    'status' => ApprovalRequestStep::STATUS_PENDING,
                ]);
            }

            return $request;
        });
    }

    /**
     * Record the contact who received the papers at a step.
     *
     * The date received is stamped the first time a receiver is typed and is
     * never moved by a later save: rewriting a recorded date stays the job of
     * the administrative trail edit (see ApprovalRequestStepController).
     */
    public static function markReceived(ApprovalRequestStep $step, string $receivedByName): void
    {
        $step->update([
            'received_by_name' => $receivedByName,
            'received_at' => $step->received_at ?? now(),
            'status' => $step->status === ApprovalRequestStep::STATUS_PENDING
                ? ApprovalRequestStep::STATUS_RECEIVED
                : $step->status,
        ]);
    }

    /**
     * Record the person who approved at a step, stamping the approval date the
     * first time the name is typed.
     */
    public static function markApproved(ApprovalRequestStep $step, string $approvedByName, User $actor): void
    {
        $step->update([
            'approved_by_name' => $approvedByName,
            'acted_by' => $actor->id,
            'acted_at' => $step->acted_at ?? now(),
            'status' => ApprovalRequestStep::STATUS_APPROVED,
        ]);
    }

    /**
     * Record the person releasing the papers from a step, stamping the release
     * date the first time the name is typed. A release without a named sender
     * still records the moment the papers left.
     */
    public static function markReleased(ApprovalRequestStep $step, ?string $sentByName): void
    {
        $step->update([
            'forwarded_by_name' => $sentByName === null || $sentByName === '' ? null : $sentByName,
            'forwarded_at' => $step->forwarded_at ?? now(),
            'status' => ApprovalRequestStep::STATUS_FORWARDED,
        ]);
    }

    /**
     * Apply the terminal effects of a completed chain and close the request.
     *
     * Procurement approvals flip the subscription to active; renewal approvals
     * apply the linked renewal's new date/cost (and reactivate a renewed
     * subscription) before the same close-out.
     */
    public static function complete(ApprovalRequest $request, User $user): void
    {
        $request->loadMissing('subscription', 'renewal');

        DB::transaction(function () use ($request, $user): void {
            $subscription = $request->subscription;

            $oldValues = [
                'status' => $subscription->status,
                'cost' => (string) $subscription->cost,
                'renewal_date' => $subscription->renewal_date?->toDateString(),
            ];

            if ($request->type === ApprovalRequest::TYPE_RENEWAL && $request->renewal instanceof Renewal) {
                $newValues = self::applyRenewal($request->renewal, $subscription);
            } else {
                $subscription->update(['status' => 'active']);
                $newValues = ['status' => 'active'];
            }

            $request->update([
                'status' => ApprovalRequest::STATUS_COMPLETED,
                'decided_by' => $user->id,
                'decided_at' => now(),
            ]);

            AuditTrail::record(
                user: $user,
                action: 'Approval Completed',
                auditable: $subscription,
                oldValues: $oldValues,
                newValues: array_merge($newValues, [
                    'request_id' => $request->id,
                    'type' => $request->type,
                ]),
                description: 'Approval chain completed for "'.$subscription->name.'"',
            );
        });

        // Mailed after the close-out rather than inside the transaction, so a
        // chain that never durably completes never tells anyone it did. The
        // mailable is queued on the database driver, so the job row rides the
        // caller's transaction and rolls back with it if that one fails.
        AdminNotifier::notifyAdmins(new ApprovalCompletedMail($request));
    }

    /**
     * Apply the linked renewal's decision to the subscription. Null proposals
     * leave the existing values untouched; the renewal row itself always
     * records the chain outcome so the history table can show
     * decision + chain status instead of a frozen intent.
     *
     * @return array<string, mixed> the values applied (for the audit row)
     */
    private static function applyRenewal(Renewal $renewal, Subscription $subscription): array
    {
        $attributes = [];

        if ($renewal->new_renewal_date !== null) {
            $attributes['renewal_date'] = $renewal->new_renewal_date->toDateString();
        }

        if ($renewal->new_cost !== null) {
            $attributes['cost'] = $renewal->new_cost;
        }

        if ($renewal->decision === 'renewed') {
            $attributes['status'] = 'active';
        }

        if ($attributes !== []) {
            $subscription->update($attributes);
        }

        // The chain outcome lands on the renewal row too: a completed
        // proposal becomes "renewed" (applied), so the history table shows
        // the outcome instead of the submission-time intent.
        if ($renewal->decision !== 'renewed') {
            $renewal->update(['decision' => 'renewed']);
        }

        return $attributes;
    }
}
