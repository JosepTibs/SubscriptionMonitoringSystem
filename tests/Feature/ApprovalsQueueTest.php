<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * A request sitting at the given office with a one-step snapshot.
 *
 * @return array{0: ApprovalRequest, 1: Office}
 */
function waitingRequest(?Office $office = null, array $attributes = []): array
{
    $office ??= Office::factory()->create();

    $request = ApprovalRequest::factory()->create($attributes);
    $request->update(['current_office_id' => $office->id]);

    ApprovalRequestStep::create([
        'approval_request_id' => $request->id,
        'office_id' => $office->id,
        'step_order' => 1,
        'status' => ApprovalRequestStep::STATUS_RECEIVED,
    ]);

    return [$request, $office];
}

it('redirects guests away from the approval queue', function () {
    $this->get(route('approvals.index'))->assertRedirect(route('login'));
});

it('lists in-progress requests oldest first and leaves decided ones out', function () {
    $user = User::factory()->create();
    [$newer] = waitingRequest();
    [$older] = waitingRequest();
    $older->forceFill(['created_at' => now()->subWeek()])->save();

    ApprovalRequest::factory()->create(['status' => ApprovalRequest::STATUS_COMPLETED]);
    ApprovalRequest::factory()->create(['status' => ApprovalRequest::STATUS_RETURNED]);

    $this->actingAs($user)
        ->get(route('approvals.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('approvals/index')
            ->has('requests.data', 2)
            ->where('requests.data.0.id', $older->id)
            ->where('requests.data.1.id', $newer->id)
            ->where('counts.in_progress', 2)
            ->where('counts.completed', 1)
            ->where('counts.returned', 1));
});

it('filters the queue by request type', function () {
    $user = User::factory()->create();
    ApprovalRequest::factory()->create(['type' => ApprovalRequest::TYPE_PROCUREMENT]);
    [$renewal] = waitingRequest(attributes: ['type' => ApprovalRequest::TYPE_RENEWAL]);

    $this->actingAs($user)
        ->get(route('approvals.index', ['type' => 'renewal']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('requests.data', 1)
            ->where('requests.data.0.id', $renewal->id)
            ->where('filters.type', 'renewal'));
});

it('filters the queue by the office holding the request', function () {
    $user = User::factory()->create();
    $first = Office::factory()->create();
    $second = Office::factory()->create();
    waitingRequest($first);
    [$atSecond] = waitingRequest($second);

    $this->actingAs($user)
        ->get(route('approvals.index', ['office_id' => $second->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('requests.data', 1)
            ->where('requests.data.0.id', $atSecond->id));

    $this->actingAs($user)
        ->get(route('approvals.index', ['office_id' => 'all']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('requests.data', 2));
});

it('shows decided requests when the status filter changes', function () {
    $user = User::factory()->create();
    waitingRequest();
    $returned = ApprovalRequest::factory()->create(['status' => ApprovalRequest::STATUS_RETURNED]);

    $this->actingAs($user)
        ->get(route('approvals.index', ['status' => 'returned']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('requests.data', 1)
            ->where('requests.data.0.id', $returned->id)
            ->where('requests.data.0.status', ApprovalRequest::STATUS_RETURNED));
});

it('exposes the trail, flow and office list to the queue page', function () {
    $user = User::factory()->create();
    $flow = ApprovalFlow::factory()->create();
    $office = Office::factory()->create(['name' => 'Records Office']);
    [$request] = waitingRequest($office);
    $request->update(['approval_flow_id' => $flow->id]);

    $this->actingAs($user)
        ->get(route('approvals.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('approvals/index')
            ->has('offices', 1)
            ->where('offices.0.name', 'Records Office')
            ->has('requests.data.0.steps', 1)
            ->where('requests.data.0.steps.0.office.name', 'Records Office')
            ->where('requests.data.0.flow.name', $flow->name)
            ->where('requests.data.0.subscription.id', $request->subscription_id));
});
