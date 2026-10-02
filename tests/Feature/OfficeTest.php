<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

/**
 * A subscription submitted through a flow that visits the given offices in
 * order, returning [subscription, approvalRequest] with the chain started.
 *
 * @return array{0: Subscription, 1: ApprovalRequest}
 */
function officeShowRequest(Office ...$offices): array
{
    $flow = ApprovalFlow::factory()->create();

    foreach ($offices as $index => $office) {
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

    return [$subscription, ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_PROCUREMENT)];
}

test('offices index is displayed in chain order', function () {
    Office::factory()->create(['name' => 'Budget', 'sort_order' => 20]);
    Office::factory()->create(['name' => 'ICT', 'sort_order' => 10]);

    $response = $this->get(route('offices.index'));

    $response->assertOk();
    $offices = collect($response->inertiaProps('offices'));
    expect($offices->pluck('name')->all())->toBe(['ICT', 'Budget']);
});

test('office can be created', function () {
    $response = $this->post(route('offices.store'), [
        'name' => 'Accounting',
        'description' => 'Handles payment checks',
    ]);

    $response->assertRedirect(route('offices.index'));

    $office = Office::where('name', 'Accounting')->first();
    expect($office)->not->toBeNull()
        ->and($office->is_active)->toBeTrue()
        ->and($office->sort_order)->toBe(10);

    expect(AuditLog::where('action', 'Office Created')->count())->toBe(1);
});

test('office name must be unique', function () {
    Office::factory()->create(['name' => 'ICT']);

    $this->post(route('offices.store'), ['name' => 'ICT'])
        ->assertSessionHasErrors('name');
});

test('office can be updated', function () {
    $office = Office::factory()->create(['name' => 'Budget']);

    $response = $this->patch(route('offices.update', $office), [
        'name' => 'Budget Management',
        'description' => 'Updated',
    ]);

    $response->assertRedirect(route('offices.index'));
    expect($office->fresh()->name)->toBe('Budget Management');

    expect(AuditLog::where('action', 'Office Updated')->count())->toBe(1);
});

test('office can be deactivated and reactivated', function () {
    $office = Office::factory()->create(['is_active' => true]);

    $this->patch(route('offices.toggle-active', $office));
    expect($office->fresh()->is_active)->toBeFalse();

    $this->patch(route('offices.toggle-active', $office));
    expect($office->fresh()->is_active)->toBeTrue();

    expect(AuditLog::where('action', 'Office Deactivated')->count())->toBe(1)
        ->and(AuditLog::where('action', 'Office Activated')->count())->toBe(1);
});

test('office show page displays the handling history', function () {
    $office = Office::factory()->create(['name' => 'Budget']);
    [$subscription] = officeShowRequest($office);

    $this->get(route('offices.show', $office))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('offices/show')
            ->where('office.name', 'Budget')
            ->where('chain_position', 1)
            ->where('counts.pending', 1)
            ->where('counts.all', 1)
            ->has('history.data', 1)
            ->where('history.data.0.approval_request.subscription.id', $subscription->id)
            ->where('history.data.0.status', 'pending'));
});

test('papers move from the approved bucket to released when forwarded', function () {
    $first = Office::factory()->create();
    $second = Office::factory()->create();
    [, $request] = officeShowRequest($first, $second);

    $this->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();

    $this->get(route('offices.show', $first))
        ->assertInertia(fn ($page) => $page
            ->where('counts.approved', 1)
            ->where('counts.released', 0)
            ->where('history.data.0.approved_by_name', 'Budget Head'));

    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    $this->get(route('offices.show', $first).'?status=released')
        ->assertInertia(fn ($page) => $page
            ->where('counts.released', 1)
            ->where('counts.approved', 0)
            ->has('history.data', 1)
            ->where('history.data.0.office_id', $first->id)
            ->where('history.data.0.status', 'forwarded'));

    $this->get(route('offices.show', $first).'?status=approved')
        ->assertInertia(fn ($page) => $page->has('history.data', 0));
});

test('returned papers appear under the returned bucket', function () {
    $office = Office::factory()->create();
    [, $request] = officeShowRequest($office);

    $this->patch(route('approval-requests.return', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();

    $this->get(route('offices.show', $office).'?status=returned')
        ->assertInertia(fn ($page) => $page
            ->where('counts.returned', 1)
            ->has('history.data', 1)
            ->where('history.data.0.status', 'returned'));
});

test('office show lists the subscriptions assigned to it', function () {
    $office = Office::factory()->create();
    $other = Office::factory()->create();
    $subscription = Subscription::factory()->create(['office_id' => $office->id]);
    Subscription::factory()->create(['office_id' => $other->id]);

    $this->get(route('offices.show', $office))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('assigned_subscriptions', 1)
            ->where('assigned_subscriptions.0.id', $subscription->id));
});

test('redirects guests away from the office show page', function () {
    $office = Office::factory()->create();

    $this->post(route('logout'));

    $this->get(route('offices.show', $office))->assertRedirect(route('login'));
});
