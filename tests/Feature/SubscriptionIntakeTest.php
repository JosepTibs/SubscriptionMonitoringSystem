<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Owner;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function validSubscriptionPayload(array $overrides = []): array
{
    return array_merge([
        'provider' => 'Microsoft',
        'name' => 'Microsoft 365',
        'cost' => '50000',
        'billing_interval' => '1',
        'billing_interval_unit' => 'year',
        'start_date' => '2026-01-01',
        'renewal_date' => '2027-01-01',
        'status' => 'active',
        'description' => null,
    ], $overrides);
}

function actingUser(): User
{
    return User::factory()->create();
}

it('creates an active subscription with no request on the approved path', function () {
    $user = actingUser();

    $response = $this->actingAs($user)
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'approved',
        ]));

    $response->assertRedirect();

    $subscription = Subscription::first();
    expect($subscription->status)->toBe('active');

    expect(ApprovalRequest::count())->toBe(0);

    expect(AuditLog::where('action', 'Subscription Created')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('creates a pending_approval subscription with a snapshot on the for_approval path', function () {
    $user = actingUser();
    $flow = ApprovalFlow::factory()->create();
    $offices = Office::factory()->count(3)->create();

    // Deliberately create steps out of order to prove the snapshot preserves step_order.
    foreach ($offices->reverse()->values() as $index => $office) {
        ApprovalFlowStep::create([
            'approval_flow_id' => $flow->id,
            'office_id' => $office->id,
            'step_order' => $index + 1,
        ]);
    }

    $this->actingAs($user)
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'for_approval',
            'approval_flow_id' => (string) $flow->id,
            'received_by_name' => 'Records Clerk',
            'status' => 'active', // client-sent status must be overridden
        ]))
        ->assertRedirect();

    $subscription = Subscription::first();
    expect($subscription->status)->toBe('pending_approval');

    $request = ApprovalRequest::where('subscription_id', $subscription->id)->first();
    expect($request)->not->toBeNull()
        ->and($request->type)->toBe(ApprovalRequest::TYPE_PROCUREMENT)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($request->approval_flow_id)->toBe($flow->id)
        ->and($request->current_office_id)->toBe($offices[2]->id); // step_order 1

    $steps = $request->steps;
    expect($steps->count())->toBe(3)
        ->and($steps->pluck('office_id')->all())->toBe([$offices[2]->id, $offices[1]->id, $offices[0]->id])
        ->and($steps->pluck('step_order')->all())->toBe([1, 2, 3])
        ->and($steps->first()->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED)
        ->and($steps->first()->received_by_name)->toBe('Records Clerk')
        ->and($steps->first()->received_at)->not->toBeNull()
        ->and($steps->skip(1)->every(fn ($step) => $step->status === ApprovalRequestStep::STATUS_PENDING))->toBeTrue();

    $audit = AuditLog::where('action', 'Subscription Submitted for Approval')
        ->where('auditable_id', $subscription->id)
        ->first();
    expect($audit)->not->toBeNull()
        ->and($audit->new_values['approval_flow'])->toBe($flow->name);
});

it('falls back to the default flow when no flow is chosen', function () {
    $user = actingUser();
    $flow = ApprovalFlow::factory()->default()->create();
    $office = Office::factory()->create();
    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $office->id,
        'step_order' => 1,
    ]);

    $this->actingAs($user)
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'for_approval',
            'received_by_name' => 'Records Clerk',
        ]))
        ->assertRedirect();

    $request = ApprovalRequest::first();
    expect($request->approval_flow_id)->toBe($flow->id)
        ->and($request->current_office_id)->toBe($office->id);
});

it('records the typed receiver on the first step of the chain', function () {
    $user = actingUser();
    $flow = ApprovalFlow::factory()->default()->create();
    $office = Office::factory()->create();
    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $office->id,
        'step_order' => 1,
    ]);

    $this->actingAs($user)
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'for_approval',
            'received_by_name' => 'Maria Santos',
        ]))
        ->assertRedirect();

    $step = ApprovalRequest::first()->steps->first();

    // The receiver is the contact at the office, typed by ICT — it must never
    // be the acting account (PRD §0).
    expect($step->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED)
        ->and($step->received_by_name)->toBe('Maria Santos')
        ->and($step->received_by_name)->not->toBe($user->name)
        ->and($step->received_at)->not->toBeNull();
});

it('requires a receiver on the for_approval path', function () {
    actingUser();
    $flow = ApprovalFlow::factory()->default()->create();
    $office = Office::factory()->create();
    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $office->id,
        'step_order' => 1,
    ]);

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'for_approval',
        ]))
        ->assertSessionHasErrors('received_by_name');

    expect(Subscription::count())->toBe(0)
        ->and(ApprovalRequest::count())->toBe(0);
});

it('blocks for_approval intake when no flow is chosen and no default exists', function () {
    actingUser();

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'for_approval',
            'received_by_name' => 'Records Clerk',
        ]))
        ->assertStatus(422);

    expect(Subscription::count())->toBe(0)
        ->and(ApprovalRequest::count())->toBe(0);
});

it('still updates a subscription without intake_mode', function () {
    $user = actingUser();
    $subscription = Subscription::factory()->create();

    $this->actingAs($user)
        ->put(route('subscriptions.update', $subscription), [
            'provider' => $subscription->provider,
            'name' => 'Renamed',
            'cost' => $subscription->cost,
            'billing_interval' => (string) $subscription->billing_interval,
            'billing_interval_unit' => $subscription->billing_interval_unit,
            'start_date' => $subscription->start_date->toDateString(),
            'renewal_date' => $subscription->renewal_date->toDateString(),
            'status' => $subscription->status,
            'description' => null,
        ])
        ->assertRedirect();

    expect($subscription->refresh()->name)->toBe('Renamed');
});

it('rejects an unknown intake mode', function () {
    actingUser();

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'invalid',
        ]))
        ->assertSessionHasErrors('intake_mode');

    expect(Subscription::count())->toBe(0);
});

it('registers a subscription for approval without any dates', function () {
    actingUser();
    $flow = ApprovalFlow::factory()->default()->create();
    $office = Office::factory()->create();
    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $office->id,
        'step_order' => 1,
    ]);

    // The approvals intake sends no dates: a submission that has not cleared
    // its chain has no confirmed start or renewal date yet.
    $payload = validSubscriptionPayload([
        'intake_mode' => 'for_approval',
        'received_by_name' => 'Records Clerk',
    ]);

    unset($payload['start_date'], $payload['renewal_date']);

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), $payload)
        ->assertRedirect();

    $subscription = Subscription::first();

    expect($subscription->start_date)->toBeNull()
        ->and($subscription->renewal_date)->toBeNull()
        ->and($subscription->status)->toBe('pending_approval')
        ->and(ApprovalRequest::where('subscription_id', $subscription->id)->exists())->toBeTrue();
});

it('still requires dates when a subscription is created as already approved', function () {
    actingUser();

    $payload = validSubscriptionPayload(['intake_mode' => 'approved']);

    unset($payload['start_date'], $payload['renewal_date']);

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), $payload)
        ->assertSessionHasErrors(['start_date', 'renewal_date']);

    expect(Subscription::count())->toBe(0);
});

it('keeps a pending subscription editable while it waits on a chain', function () {
    $subscription = Subscription::factory()->create([
        'status' => 'pending_approval',
        'start_date' => null,
        'renewal_date' => null,
    ]);

    $this->actingAs(actingUser())
        ->put(route('subscriptions.update', $subscription), [
            'provider' => $subscription->provider,
            'name' => 'Renamed while pending',
            'cost' => $subscription->cost,
            'billing_interval' => (string) $subscription->billing_interval,
            'billing_interval_unit' => $subscription->billing_interval_unit,
            'status' => $subscription->status,
            'description' => null,
        ])
        ->assertRedirect();

    expect($subscription->refresh()->name)->toBe('Renamed while pending')
        ->and($subscription->renewal_date)->toBeNull();
});

it('stores the department that owns the subscription', function () {
    $owner = Owner::factory()->create(['name' => 'ICT Department']);

    $this->actingAs(actingUser())
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'approved',
            'owner_id' => (string) $owner->id,
        ]))
        ->assertRedirect();

    $subscription = Subscription::first();

    expect($subscription->owner_id)->toBe($owner->id)
        ->and($subscription->owner->name)->toBe('ICT Department');
});

it('rejects an owner_id that is not a department', function () {
    $user = actingUser();

    $this->actingAs($user)
        ->post(route('subscriptions.store'), validSubscriptionPayload([
            'intake_mode' => 'approved',
            'owner_id' => (string) $user->id,
        ]))
        ->assertSessionHasErrors('owner_id');

    expect(Subscription::count())->toBe(0);
});

it('renders the approval intake form with its options', function () {
    Office::factory()->create(['name' => 'Records Office']);
    Owner::factory()->create(['name' => 'ICT Department']);
    ApprovalFlow::factory()->create(['name' => 'Procurement']);

    $this->actingAs(actingUser())
        ->get(route('approvals.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('approvals/create')
            ->has('offices')
            ->has('owners')
            ->has('approval_flows')
        );
});
