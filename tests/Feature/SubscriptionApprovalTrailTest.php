<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

/**
 * Build a subscription with a procurement request whose snapshot comes from
 * the given flow (mirrors what the for-approval intake path creates).
 *
 * @return array{0: Subscription, 1: ApprovalRequest, 2: Collection<int, Office>}
 */
function subscriptionWithChain(ApprovalFlow $flow, int $officeCount = 3): array
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

    $request = ApprovalRequest::create([
        'subscription_id' => $subscription->id,
        'type' => ApprovalRequest::TYPE_PROCUREMENT,
        'approval_flow_id' => $flow->id,
        'current_office_id' => $offices[0]->id,
        'status' => ApprovalRequest::STATUS_IN_PROGRESS,
    ]);

    foreach ($offices->values() as $index => $office) {
        ApprovalRequestStep::create([
            'approval_request_id' => $request->id,
            'office_id' => $office->id,
            'step_order' => $index + 1,
            'status' => ApprovalRequestStep::STATUS_PENDING,
        ]);
    }

    return [$subscription, $request, $offices];
}

it('renders the approval trail from the flow snapshot', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create(['name' => 'Big Purchases']);

    [$subscription, $request, $offices] = subscriptionWithChain($flow);

    // Simulate the first office acting (the chain runtime lands in milestone 3).
    $request->steps()->where('step_order', 1)->update([
        'status' => ApprovalRequestStep::STATUS_APPROVED,
        'acted_by' => $user->id,
        'acted_at' => now(),
        'remarks' => 'Specs verified',
    ]);

    $this->actingAs($user)
        ->get(route('subscriptions.show', $subscription))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/show')
            ->has('approval_requests', 1)
            ->where('approval_requests.0.type', ApprovalRequest::TYPE_PROCUREMENT)
            ->where('approval_requests.0.status', ApprovalRequest::STATUS_IN_PROGRESS)
            ->where('approval_requests.0.flow.name', 'Big Purchases')
            ->where('approval_requests.0.current_office.name', $offices[0]->name)
            ->has('approval_requests.0.steps', 3)
            ->where('approval_requests.0.steps.0.step_order', 1)
            ->where('approval_requests.0.steps.0.office.name', $offices[0]->name)
            ->where('approval_requests.0.steps.0.status', ApprovalRequestStep::STATUS_APPROVED)
            ->where('approval_requests.0.steps.0.actor.name', $user->name)
            ->where('approval_requests.0.steps.2.step_order', 3)
            ->where('approval_requests.0.steps.2.office.name', $offices[2]->name)
            ->where('approval_requests.0.steps.2.status', ApprovalRequestStep::STATUS_PENDING)
            ->where('approval_requests.0.steps.2.actor', null));
});

it('renders an empty trail for a subscription without an approval chain', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->actingAs($user)
        ->get(route('subscriptions.show', $subscription))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/show')
            ->has('approval_requests', 0));
});

it('exposes the renewal proposal on a renewal request', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create();

    [$subscription, $request, $offices] = subscriptionWithChain($flow, 2);

    $renewal = $subscription->renewals()->create([
        'previous_renewal_date' => $subscription->renewal_date,
        'new_renewal_date' => '2027-06-01',
        'previous_cost' => $subscription->cost,
        'new_cost' => '60000',
        'decision' => 'renewed',
        'reviewed_by' => $user->id,
        'reviewed_at' => now(),
        'remarks' => 'Vendor gave a discount',
    ]);

    $request->update([
        'type' => ApprovalRequest::TYPE_RENEWAL,
        'renewal_id' => $renewal->id,
    ]);

    $this->actingAs($user)
        ->get(route('subscriptions.show', $subscription))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/show')
            ->has('approval_requests', 1)
            ->where('approval_requests.0.type', ApprovalRequest::TYPE_RENEWAL)
            ->where('approval_requests.0.renewal_id', $renewal->id));
});
