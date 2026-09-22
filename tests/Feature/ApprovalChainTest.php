<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

/**
 * Build a subscription sitting at the first office of a freshly snapshotted
 * chain, exactly as the for-approval intake path creates it.
 *
 * @return array{0: Subscription, 1: ApprovalRequest, 2: Collection<int, Office>}
 */
function chainSubscription(ApprovalFlow $flow, int $officeCount = 3): array
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
        'status' => 'pending_approval',
        'approval_flow_id' => $flow->id,
    ]);

    $request = ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_PROCUREMENT);

    return [$subscription, $request, $offices];
}

function chainReviewer(): User
{
    return User::factory()->create();
}

function chainStep(ApprovalRequest $request, int $stepOrder): ApprovalRequestStep
{
    return $request->steps()->where('step_order', $stepOrder)->firstOrFail();
}

it('records an approval without moving the pointer and audits it', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['remarks' => 'Specs verified'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $step = chainStep($request, 1);
    expect($step->status)->toBe(ApprovalRequestStep::STATUS_APPROVED)
        ->and($step->acted_by)->toBe($user->id)
        ->and($step->acted_at)->not->toBeNull()
        ->and($step->remarks)->toBe('Specs verified');

    expect($request->refresh()->current_office_id)->toBe($offices[0]->id)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($subscription->refresh()->status)->toBe('pending_approval');

    expect(AuditLog::where('action', 'Approval Approved')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('refuses to forward a step that has not been approved yet', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.forward', $request))
        ->assertStatus(422);

    expect(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and($request->refresh()->current_office_id)->toBe($offices[0]->id);
});

it('moves an approved request to the next office without skipping steps', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['remarks' => 'ok'])
        ->assertRedirect();

    $this->patch(route('approval-requests.forward', $request), ['remarks' => 'Sending up'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    expect(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED)
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and($request->refresh()->current_office_id)->toBe($offices[1]->id)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS);

    expect(AuditLog::where('action', 'Approval Forwarded')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('skips deactivated offices when forwarding and keeps their history intact', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $offices[1]->update(['is_active' => false]);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    expect($request->refresh()->current_office_id)->toBe($offices[2]->id)
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED);
});

it('completes a procurement chain when the final office approves', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), ['remarks' => 'Office 1 ok'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['remarks' => 'Office 2 ok'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['remarks' => 'Final approval'])->assertRedirect();

    $request->refresh();

    expect($request->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and($request->decided_by)->toBe($user->id)
        ->and($request->decided_at)->not->toBeNull()
        ->and($request->current_office_id)->toBe($offices[2]->id)
        ->and($subscription->refresh()->status)->toBe('active')
        ->and(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_APPROVED);

    $audit = AuditLog::where('action', 'Approval Completed')
        ->where('auditable_id', $subscription->id)
        ->first();

    expect($audit)->not->toBeNull()
        ->and($audit->new_values['status'])->toBe('active')
        ->and($audit->new_values['type'])->toBe(ApprovalRequest::TYPE_PROCUREMENT);
});

it('blocks forwarding the final step until that office has approved', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 2);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    // Sitting at the final office without its approval: the pointer must not move.
    $this->patch(route('approval-requests.forward', $request))->assertStatus(422);

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($request->current_office_id)->toBe($offices[1]->id)
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED);
});

it('closes the chain instead of stranding a request when no active office is left ahead', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request))->assertRedirect();

    // The only office still ahead is deactivated mid-flight.
    $offices[2]->update(['is_active' => false]);

    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    $request->refresh();

    expect($request->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and($request->current_office_id)->toBe($offices[1]->id)
        ->and($subscription->refresh()->status)->toBe('active')
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_PENDING);
});

it('requires remarks to return a request and then stops the chain', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.return', $request))
        ->assertSessionHasErrors('remarks');

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS);

    $this->patch(route('approval-requests.return', $request), ['remarks' => 'Budget not approved'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $request->refresh();

    expect($request->status)->toBe(ApprovalRequest::STATUS_RETURNED)
        ->and($request->remarks)->toBe('Budget not approved')
        ->and($request->decided_by)->toBe($user->id)
        ->and(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_RETURNED)
        ->and(chainStep($request, 1)->remarks)->toBe('Budget not approved');

    // A returned request can no longer travel.
    $this->patch(route('approval-requests.approve', $request))->assertStatus(403);
    $this->patch(route('approval-requests.forward', $request))->assertStatus(403);

    expect(AuditLog::where('action', 'Approval Returned')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('forbids acting on a request that is no longer in progress', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 1);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED);

    $this->patch(route('approval-requests.approve', $request))->assertStatus(403);
    $this->patch(route('approval-requests.forward', $request))->assertStatus(403);
    $this->patch(route('approval-requests.return', $request), ['remarks' => 'too late'])->assertStatus(403);
});

it('returns a 404 for an unknown request', function () {
    $this->actingAs(chainReviewer())
        ->patch(route('approval-requests.approve', 9999))
        ->assertStatus(404);
});

it('applies the linked renewal when a renewal chain completes', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 2);

    $renewal = $subscription->renewals()->create([
        'previous_renewal_date' => $subscription->renewal_date,
        'new_renewal_date' => '2027-06-01',
        'previous_cost' => $subscription->cost,
        'new_cost' => '60000',
        'decision' => 'renewed',
        'reviewed_by' => $user->id,
        'reviewed_at' => now(),
        'remarks' => 'Vendor discount',
    ]);

    $subscription->update(['status' => 'expired']);
    $request->update(['type' => ApprovalRequest::TYPE_RENEWAL, 'renewal_id' => $renewal->id]);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request))->assertRedirect();

    $subscription->refresh();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and($subscription->cost)->toBe('60000.00')
        ->and($subscription->renewal_date->toDateString())->toBe('2027-06-01')
        ->and($subscription->status)->toBe('active');
});

it('leaves the subscription untouched when a pending renewal proposal completes', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 2);
    $originalDate = $subscription->renewal_date->toDateString();
    $originalCost = (string) $subscription->cost;

    $renewal = $subscription->renewals()->create([
        'previous_renewal_date' => $subscription->renewal_date,
        'new_renewal_date' => null,
        'previous_cost' => $subscription->cost,
        'new_cost' => null,
        'decision' => 'pending',
        'reviewed_by' => $user->id,
        'reviewed_at' => now(),
    ]);

    $request->update(['type' => ApprovalRequest::TYPE_RENEWAL, 'renewal_id' => $renewal->id]);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request))->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request))->assertRedirect();

    $subscription->refresh();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and((string) $subscription->cost)->toBe($originalCost)
        ->and($subscription->renewal_date->toDateString())->toBe($originalDate)
        ->and($subscription->status)->toBe('pending_approval');
});
