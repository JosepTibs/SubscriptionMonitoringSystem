<?php

namespace App\Services;

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
     * has somewhere to sit.
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
    }

    /**
     * Apply the linked renewal's decision to the subscription. Null proposals
     * (a "keep pending" review) leave the existing values untouched.
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

        if ($attributes === []) {
            return ['decision' => $renewal->decision];
        }

        $subscription->update($attributes);

        return $attributes;
    }
}
