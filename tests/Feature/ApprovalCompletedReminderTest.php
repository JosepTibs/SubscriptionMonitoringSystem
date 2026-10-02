<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

/**
 * A subscription sitting at the first office of a chain, still dateless the way
 * for-approval intake leaves it.
 *
 * @return array{0: Subscription, 1: ApprovalRequest, 2: Collection<int, Office>}
 */
function datelessChainSubscription(ApprovalFlow $flow): array
{
    $offices = Office::factory()->count(1)->create();

    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $offices[0]->id,
        'step_order' => 1,
    ]);

    $subscription = Subscription::factory()->create([
        'status' => 'pending_approval',
        'approval_flow_id' => $flow->id,
        'start_date' => null,
        'renewal_date' => null,
    ]);

    $request = ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_PROCUREMENT);

    return [$subscription, $request, $offices];
}

it('serves a completed request with the dates still missing so the reminder can show', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = datelessChainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    // The banner's condition is a pure function of these two props, so they are
    // what the page has to carry: the chain is done and a date is still absent.
    $this->get(route('subscriptions.show', $subscription))
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/show')
            ->where('approval_requests.0.status', ApprovalRequest::STATUS_COMPLETED)
            ->where('subscription.start_date', null)
            ->where('subscription.renewal_date', null)
        );
});

it('stops offering the reminder once both dates are recorded', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = datelessChainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head']);

    $subscription->update(['start_date' => '2025-03-01', 'renewal_date' => '2026-03-01']);

    // The dates are 'date'-cast, so the page receives serialised datetimes
    // rather than the typed strings; comparing against the model's own
    // serialisation keeps the assertion about the props, not about the format.
    $expected = $subscription->refresh()->only(['start_date', 'renewal_date']);

    $this->get(route('subscriptions.show', $subscription))
        ->assertInertia(fn ($page) => $page
            ->where('approval_requests.0.status', ApprovalRequest::STATUS_COMPLETED)
            ->where('subscription.start_date', $expected['start_date']->toJSON())
            ->where('subscription.renewal_date', $expected['renewal_date']->toJSON())
            ->etc()
        );
});

it('keeps a still-travelling request out of the completed state', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = datelessChainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head'])
        ->assertRedirect();

    // A second chain that has not been decided must not read as complete.
    $pending = ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_RENEWAL);

    $this->get(route('subscriptions.show', $subscription))
        ->assertInertia(fn ($page) => $page
            ->where('approval_requests.0.id', $request->id)
            ->where('approval_requests.0.status', ApprovalRequest::STATUS_COMPLETED)
            ->where('approval_requests.1.id', $pending->id)
            ->where('approval_requests.1.status', ApprovalRequest::STATUS_IN_PROGRESS)
        );
});
