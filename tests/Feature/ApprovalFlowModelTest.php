<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('enforces exactly one default flow', function () {
    $first = ApprovalFlow::factory()->default()->create(['name' => 'First']);
    $second = ApprovalFlow::factory()->create(['name' => 'Second']);

    $second->update(['is_default' => true]);

    expect($second->refresh()->is_default)->toBeTrue()
        ->and($first->refresh()->is_default)->toBeFalse()
        ->and(ApprovalFlow::defaultFlow()->is($second))->toBeTrue();
});

it('returns null when no default flow exists', function () {
    ApprovalFlow::factory()->create(['is_default' => false]);

    expect(ApprovalFlow::defaultFlow())->toBeNull();
});

it('orders steps by step_order', function () {
    $flow = ApprovalFlow::factory()->create();
    $offices = Office::factory()->count(3)->create();

    foreach ($offices->reverse()->values() as $index => $office) {
        ApprovalFlowStep::factory()->for($flow, 'flow')->create([
            'office_id' => $office->id,
            'step_order' => $index + 1,
        ]);
    }

    expect($flow->steps->pluck('step_order')->toArray())->toBe([1, 2, 3]);
});

it('scopes in-progress requests to the given office', function () {
    $office = Office::factory()->create();
    $otherOffice = Office::factory()->create();

    $subscription = Subscription::factory()->create();

    $mine = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'current_office_id' => $office->id,
        'status' => ApprovalRequest::STATUS_IN_PROGRESS,
    ]);
    ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'current_office_id' => $otherOffice->id,
        'status' => ApprovalRequest::STATUS_IN_PROGRESS,
    ]);
    ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'current_office_id' => $office->id,
        'status' => ApprovalRequest::STATUS_COMPLETED,
    ]);

    $results = ApprovalRequest::atOffice($office->id)->get();

    expect($results->count())->toBe(1)
        ->and($results->first()->is($mine))->toBeTrue();
});

it('orders request steps and resolves their actor and office', function () {
    $office = Office::factory()->create();
    $actor = User::factory()->create();
    $subscription = Subscription::factory()->create();
    $request = ApprovalRequest::factory()->create(['subscription_id' => $subscription->id]);

    $step = ApprovalRequestStep::factory()->create([
        'approval_request_id' => $request->id,
        'office_id' => $office->id,
        'acted_by' => $actor->id,
        'step_order' => 1,
    ]);

    expect($request->steps->first()->is($step))->toBeTrue()
        ->and($step->office->is($office))->toBeTrue()
        ->and($step->actor->is($actor))->toBeTrue();
});
