<?php

use App\Models\activity_logs;
use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Models\Owner;
use App\Models\Renewal;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('logs created, updated and deleted events for trait models', function () {
    $office = Office::create(['name' => 'Budget', 'sort_order' => 1, 'is_active' => true]);

    expect(activity_logs::where('subject_type', (new Office)->getMorphClass())
        ->where('subject_id', $office->id)
        ->where('event', 'created')->count())->toBe(1)
        ->and(activity_logs::latest('id')->first()->description)->toContain('Created Office: Budget');

    $office->update(['name' => 'Accounting']);

    expect(activity_logs::where('subject_type', (new Office)->getMorphClass())
        ->where('subject_id', $office->id)
        ->where('event', 'updated')->count())->toBe(1);

    $office->delete();

    expect(activity_logs::where('subject_type', (new Office)->getMorphClass())
        ->where('subject_id', $office->id)
        ->where('event', 'deleted')->count())->toBe(1);
});

it('logs every business model using the trait', function () {
    $owner = Owner::create(['name' => 'ICT']);
    $flow = ApprovalFlow::create(['name' => 'Standard']);
    $user = User::factory()->create(['username' => 'encoder1']);

    foreach ([
        [$owner, Owner::class, 'ICT'],
        [$flow, ApprovalFlow::class, 'Standard'],
        [$user, User::class, 'encoder1'],
    ] as [$model, $type, $label]) {
        expect(activity_logs::where('subject_type', (new $type)->getMorphClass())
            ->where('subject_id', $model->getKey())
            ->where('event', 'created')->exists())->toBeTrue("missing created log for {$type}: {$label}");
    }

    $subscription = Subscription::create([
        'provider' => 'StreamCo',
        'name' => 'StreamCo Plan',
        'cost' => 99.00,
        'billing_interval' => 1,
        'billing_interval_unit' => 'month',
        'start_date' => now()->toDateString(),
        'renewal_date' => now()->addMonth()->toDateString(),
        'status' => 'active',
    ]);

    expect(activity_logs::where('subject_type', (new Subscription)->getMorphClass())
        ->where('subject_id', $subscription->id)
        ->where('event', 'created')->exists())->toBeTrue();
});

it('never stores passwords or hidden attributes in activity properties', function () {
    $user = User::factory()->create(['username' => 'secretcheck']);

    $log = activity_logs::where('subject_type', (new User)->getMorphClass())
        ->where('subject_id', $user->id)
        ->where('event', 'created')
        ->latest('id')->first();

    expect($log)->not->toBeNull()
        ->and($log->properties['data'] ?? [])->not->toHaveKey('password')
        ->and($log->properties['data'] ?? [])->not->toHaveKey('remember_token');

    $user->update(['email' => 'rotated@example.com']);

    $updateLog = activity_logs::where('subject_type', (new User)->getMorphClass())
        ->where('subject_id', $user->id)
        ->where('event', 'updated')
        ->latest('id')->first();

    expect($updateLog->properties['old'] ?? [])->not->toHaveKey('password')
        ->and($updateLog->properties['new'] ?? [])->not->toHaveKey('password');
});

it('resolves a null actor when the acting user row is gone', function () {
    $user = User::factory()->create(['username' => 'selfdelete']);
    $this->actingAs($user);

    $user->delete();

    $log = activity_logs::where('subject_type', (new User)->getMorphClass())
        ->where('subject_id', $user->id)
        ->where('event', 'deleted')
        ->latest('id')->first();

    expect($log)->not->toBeNull()->and($log->user_id)->toBeNull();
});

it('describes approval steps with subscription, step and typed names', function () {
    $office = Office::factory()->create(['name' => 'Budget']);
    $subscription = Subscription::factory()->create(['name' => 'Netflix']);
    $request = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'type' => ApprovalRequest::TYPE_PROCUREMENT,
    ]);
    $step = ApprovalRequestStep::factory()->create([
        'approval_request_id' => $request->id,
        'office_id' => $office->id,
        'step_order' => 2,
        'status' => ApprovalRequestStep::STATUS_PENDING,
    ]);

    $step->update([
        'approved_by_name' => 'Budget Head',
        'status' => ApprovalRequestStep::STATUS_APPROVED,
    ]);

    $log = activity_logs::where('subject_type', (new ApprovalRequestStep)->getMorphClass())
        ->where('subject_id', $step->id)
        ->where('event', 'updated')
        ->latest('id')->first();

    expect($log)->not->toBeNull()
        ->and($log->description)->toContain("'Netflix'")
        ->and($log->description)->toContain('Step 2 @ Budget')
        ->and($log->description)->toContain("approved by 'Budget Head'")
        ->and($log->properties['context']['subscription_name'] ?? null)->toBe('Netflix')
        ->and($log->properties['context']['approved_by'] ?? null)->toBe('Budget Head');
});

it('describes approval request deletes with the subscription', function () {
    $subscription = Subscription::factory()->create(['name' => 'StreamCo Plan']);
    $request = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'type' => ApprovalRequest::TYPE_PROCUREMENT,
    ]);

    // Cascade from the subscription would erase the request; deleting the
    // request directly pins the rich description instead.
    $request->load('subscription')->delete();

    $log = activity_logs::where('subject_type', (new ApprovalRequest)->getMorphClass())
        ->where('subject_id', $request->id)
        ->where('event', 'deleted')
        ->latest('id')->first();

    expect($log)->not->toBeNull()
        ->and($log->description)->toContain("'StreamCo Plan'")
        ->and($log->properties['context']['subscription_name'] ?? null)->toBe('StreamCo Plan');
});

it('describes renewals and flow steps with their subscription context', function () {
    $office = Office::factory()->create(['name' => 'Accounting']);
    $flow = ApprovalFlow::factory()->create(['name' => 'Standard']);
    $flowStep = ApprovalFlowStep::factory()->create([
        'approval_flow_id' => $flow->id,
        'office_id' => $office->id,
        'step_order' => 1,
    ]);
    $subscription = Subscription::factory()->create(['name' => 'Fiber Plan']);
    $renewal = Renewal::create([
        'subscription_id' => $subscription->id,
        'previous_renewal_date' => $subscription->renewal_date,
        'new_renewal_date' => '2027-06-01',
        'previous_cost' => $subscription->cost,
        'new_cost' => '60000',
        'decision' => 'renewed',
        'reviewed_at' => now(),
    ]);

    $flowLog = activity_logs::where('subject_type', (new ApprovalFlowStep)->getMorphClass())
        ->where('subject_id', $flowStep->id)
        ->where('event', 'created')
        ->latest('id')->first();

    $renewalLog = activity_logs::where('subject_type', (new Renewal)->getMorphClass())
        ->where('subject_id', $renewal->id)
        ->where('event', 'created')
        ->latest('id')->first();

    expect($flowLog)->not->toBeNull()
        ->and($flowLog->description)->toContain('Standard · Step 1 @ Accounting')
        ->and($renewalLog)->not->toBeNull()
        ->and($renewalLog->description)->toContain("'Fiber Plan'")
        ->and($renewalLog->properties['context']['subscription_name'] ?? null)->toBe('Fiber Plan');
});
