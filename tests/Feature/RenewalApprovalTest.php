<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

/**
 * Build a subscription with deterministic money/dates, assigned to a flow whose
 * steps walk the given offices in creation order.
 *
 * @return array{0: Subscription, 1: Collection<int, Office>}
 */
function renewalSubscription(ApprovalFlow $flow, int $officeCount = 2): array
{
    $offices = Office::factory()->count($officeCount)->create();

    foreach ($offices->values() as $index => $office) {
        ApprovalFlowStep::create([
            'approval_flow_id' => $flow->id,
            'office_id' => $office->id,
            'step_order' => $index + 1,
        ]);
    }

    $subscription = Subscription::factory()->create([
        'cost' => '1000',
        'start_date' => '2025-03-01',
        'renewal_date' => '2026-03-01',
        'status' => 'active',
        'approval_flow_id' => $flow->id,
    ]);

    return [$subscription, $offices];
}

function renewalReviewer(): User
{
    return User::factory()->create();
}

it('opens a renewal approval request with a flow snapshot on a renewed decision', function () {
    $user = renewalReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $offices] = renewalSubscription($flow);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), [
            'decision' => 'renewed',
            'new_renewal_date' => '2027-06-01',
            'new_cost' => '60000',
            'remarks' => 'Vendor gave a discount',
        ])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $renewal = $subscription->renewals()->first();

    expect($renewal)->not->toBeNull()
        ->and($renewal->decision)->toBe('renewed')
        ->and($renewal->new_renewal_date->toDateString())->toBe('2027-06-01')
        ->and($renewal->new_cost)->toBe('60000.00')
        ->and($renewal->previous_renewal_date->toDateString())->toBe('2026-03-01')
        ->and($renewal->reviewed_by)->toBe($user->id);

    $request = ApprovalRequest::where('subscription_id', $subscription->id)->first();

    expect($request)->not->toBeNull()
        ->and($request->type)->toBe(ApprovalRequest::TYPE_RENEWAL)
        ->and($request->renewal_id)->toBe($renewal->id)
        ->and($request->approval_flow_id)->toBe($flow->id)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($request->current_office_id)->toBe($offices[0]->id)
        ->and($request->steps()->count())->toBe(2)
        ->and($request->steps()->pluck('step_order')->all())->toBe([1, 2]);

    // The proposal must not reach the subscription until the chain completes.
    $subscription->refresh();

    expect((string) $subscription->cost)->toBe('1000.00')
        ->and($subscription->renewal_date->toDateString())->toBe('2026-03-01')
        ->and($subscription->status)->toBe('active');

    expect(AuditLog::where('action', 'Renewal Submitted for Approval')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('opens a pending renewal request through the default flow', function () {
    $user = renewalReviewer();
    $flow = ApprovalFlow::factory()->default()->create();
    [$subscription, $offices] = renewalSubscription($flow, 1);

    $subscription->update(['approval_flow_id' => null]);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), [
            'decision' => 'pending',
            'new_renewal_date' => '2027-01-01',
            'new_cost' => '1500',
            'remarks' => 'Waiting on the vendor quote',
        ])
        ->assertRedirect();

    $request = ApprovalRequest::where('subscription_id', $subscription->id)->first();

    expect($request)->not->toBeNull()
        ->and($request->type)->toBe(ApprovalRequest::TYPE_RENEWAL)
        ->and($request->approval_flow_id)->toBe($flow->id)
        ->and($request->current_office_id)->toBe($offices[0]->id)
        ->and($subscription->refresh()->status)->toBe('active')
        ->and((string) $subscription->cost)->toBe('1000.00');
});

it('applies a cancelled decision immediately without opening a chain', function () {
    $user = renewalReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $offices] = renewalSubscription($flow);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), ['decision' => 'cancelled'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    expect(ApprovalRequest::count())->toBe(0)
        ->and($subscription->refresh()->status)->toBe('cancelled')
        ->and($subscription->renewals()->count())->toBe(1)
        ->and((string) $subscription->cost)->toBe('1000.00');

    expect(AuditLog::where('action', 'Renewal Reviewed')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('blocks a renewal when no approval flow is configured', function () {
    $user = renewalReviewer();
    $subscription = Subscription::factory()->create([
        'cost' => '1000',
        'renewal_date' => '2026-03-01',
        'status' => 'active',
    ]);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), [
            'decision' => 'renewed',
            'new_renewal_date' => '2027-06-01',
            'new_cost' => '60000',
        ])
        ->assertSessionHasErrors('decision');

    expect($subscription->renewals()->count())->toBe(0)
        ->and(ApprovalRequest::count())->toBe(0)
        ->and($subscription->refresh()->status)->toBe('active')
        ->and((string) $subscription->cost)->toBe('1000.00')
        ->and($subscription->renewal_date->toDateString())->toBe('2026-03-01');
});

it('applies the approved renewal to the subscription when the chain completes', function () {
    $user = renewalReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $offices] = renewalSubscription($flow);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), [
            'decision' => 'renewed',
            'new_renewal_date' => '2027-06-01',
            'new_cost' => '60000',
            'remarks' => 'Approved by management',
        ])
        ->assertRedirect();

    $request = ApprovalRequest::where('subscription_id', $subscription->id)->firstOrFail();

    $this->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request))->assertRedirect();

    $subscription->refresh();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and((string) $subscription->cost)->toBe('60000.00')
        ->and($subscription->renewal_date->toDateString())->toBe('2027-06-01')
        ->and($subscription->status)->toBe('active');

    $audit = AuditLog::where('action', 'Approval Completed')
        ->where('auditable_id', $subscription->id)
        ->first();

    expect($audit)->not->toBeNull()
        ->and($audit->new_values['type'])->toBe(ApprovalRequest::TYPE_RENEWAL)
        ->and($audit->new_values['cost'])->toBe('60000.00');
});
