<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

/**
 * A chain sitting at the first office with the given number of offices.
 *
 * @return array{0: Subscription, 1: ApprovalRequest, 2: Collection<int, Office>}
 */
function stepChain(ApprovalFlow $flow, int $officeCount = 2): array
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

function stepUser(): User
{
    return User::factory()->create();
}

function trailStep(ApprovalRequest $request, int $order): ApprovalRequestStep
{
    return $request->steps()->where('step_order', $order)->firstOrFail();
}

/**
 * The sequence the trail's check button sends: the names a step takes, in the
 * only order the runtime accepts.
 *
 * The table refuses to send a later name while an earlier one is blank, so the
 * guarantee worth protecting is that this order is always legal - and that
 * skipping ahead of it is still refused.
 */
it('accepts a whole step recorded in one pass, in order', function () {
    $user = stepUser();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = stepChain($flow);

    $this->actingAs($user)->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Ana Reyes'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Ben Cruz'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Cara Diaz'])->assertRedirect();

    $step = trailStep($request->refresh(), 1);

    expect($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($step->received_by_name)->toBe('Ana Reyes')
        ->and($step->approved_by_name)->toBe('Ben Cruz')
        ->and($step->forwarded_by_name)->toBe('Cara Diaz')
        ->and($step->received_at)->not->toBeNull()
        ->and($step->acted_at)->not->toBeNull()
        ->and($step->forwarded_at)->not->toBeNull()
        ->and($request->current_office_id)->toBe($offices[1]->id);
});

it('refuses to release a step that was never approved', function () {
    $user = stepUser();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = stepChain($flow);

    $this->actingAs($user)->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Ana Reyes'])->assertRedirect();

    // This is the request the table's guard exists to prevent: without it the
    // 422 carries no field key and the trail would show nothing at all.
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Cara Diaz'])->assertStatus(422);

    expect(trailStep($request->refresh(), 1)->forwarded_by_name)->toBeNull()
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS);
});

it('records the receiver without touching the signatory or the release', function () {
    $user = stepUser();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = stepChain($flow);

    $this->actingAs($user)->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Ana Reyes'])->assertRedirect();

    $step = trailStep($request->refresh(), 1);

    expect($step->received_by_name)->toBe('Ana Reyes')
        ->and($step->approved_by_name)->toBeNull()
        ->and($step->forwarded_by_name)->toBeNull()
        ->and($step->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED);
});

it('completes the chain on the final office, which has no release of its own', function () {
    $user = stepUser();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = stepChain($flow, 1);

    $this->actingAs($user)->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Ana Reyes'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Ben Cruz'])->assertRedirect();

    $request->refresh();

    // The last office's row drops the sent columns entirely, so the chain ends
    // on the approval rather than on a release that has nowhere to go.
    expect($request->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and(trailStep($request, 1)->forwarded_by_name)->toBeNull()
        ->and(trailStep($request, 1)->forwarded_at)->toBeNull()
        ->and($subscription->refresh()->status)->toBe('active');
});

it('leaves the destination receiver to be recorded on arrival', function () {
    $user = stepUser();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = stepChain($flow);

    $this->actingAs($user)->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Ana Reyes'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Ben Cruz'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Cara Diaz'])->assertRedirect();

    // The next office records its own receiver when the papers arrive there, so
    // a single pass must not stamp one ahead of the hand-off.
    expect(trailStep($request->refresh(), 2)->received_by_name)->toBeNull()
        ->and(trailStep($request, 2)->received_at)->toBeNull();
});
