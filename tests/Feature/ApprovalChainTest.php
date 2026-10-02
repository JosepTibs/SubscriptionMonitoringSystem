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
use Illuminate\Support\Facades\Schema;

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
        ->patch(route('approval-requests.approve', $request), [
            'approved_by_name' => 'Budget Head',
        ])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $step = chainStep($request, 1);
    expect($step->status)->toBe(ApprovalRequestStep::STATUS_APPROVED)
        ->and($step->acted_by)->toBe($user->id)
        ->and($step->approved_by_name)->toBe('Budget Head')
        ->and($step->acted_at)->not->toBeNull();

    expect($request->refresh()->current_office_id)->toBe($offices[0]->id)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($subscription->refresh()->status)->toBe('pending_approval');

    expect(AuditLog::where('action', 'Approval Approved')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('no longer credits the acting account by name once that user is deleted', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();

    $user->delete();

    $step = chainStep($request, 1)->refresh();

    // The encoder stays accountable through acted_by while they exist, but the
    // account's name is never written as an approval (PRD §0): the trail names
    // the typed signatory, which survives the account deletion.
    expect($step->acted_by)->toBeNull()
        ->and($step->approved_by_name)->toBe('Budget Head');
});

it('renames the step name column and adds the hand-off columns', function () {
    expect(Schema::hasColumn('approval_request_steps', 'approved_by_name'))->toBeTrue()
        ->and(Schema::hasColumn('approval_request_steps', 'acted_by_name'))->toBeFalse()
        ->and(Schema::hasColumn('approval_request_steps', 'received_by_name'))->toBeTrue()
        ->and(Schema::hasColumn('approval_request_steps', 'received_at'))->toBeTrue()
        ->and(Schema::hasColumn('approval_request_steps', 'forwarded_by_name'))->toBeTrue()
        ->and(Schema::hasColumn('approval_request_steps', 'forwarded_at'))->toBeTrue()
        // Free-text notes were dropped from the approval domain: the trail is
        // the typed names plus the dates stamped beside them.
        ->and(Schema::hasColumn('approval_request_steps', 'remarks'))->toBeFalse()
        ->and(Schema::hasColumn('approval_requests', 'remarks'))->toBeFalse();
});

it('records who released the papers and when on forward', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])
        ->assertRedirect();

    $this->patch(route('approval-requests.forward', $request), [
        'sent_by_name' => 'Budget Officer',
    ])->assertRedirect(route('subscriptions.show', $subscription));

    $released = chainStep($request, 1);

    // Signing off and releasing are separate events, each with its own person
    // and moment.
    expect($released->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        ->and($released->forwarded_by_name)->toBe('Budget Officer')
        ->and($released->forwarded_at)->not->toBeNull()
        ->and($released->approved_by_name)->toBe('Budget Head')
        ->and($released->acted_at)->not->toBeNull();
});

it('still forwards when the releaser is not named', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])
        ->assertRedirect();

    $this->patch(route('approval-requests.forward', $request))
        ->assertRedirect(route('subscriptions.show', $subscription));

    $released = chainStep($request, 1);

    // The sent columns stay empty so the trail can fall back to the signatory
    // instead of inventing a name.
    expect($released->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        ->and($released->forwarded_by_name)->toBeNull()
        ->and($released->forwarded_at)->not->toBeNull();
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

it('moves the papers on without stamping the destination, which records its own receiver', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])
        ->assertRedirect();

    $this->patch(route('approval-requests.forward', $request), [
        'sent_by_name' => 'Budget Officer',
    ])->assertRedirect(route('subscriptions.show', $subscription));

    expect(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_FORWARDED)
        // Nothing is stamped ahead of the hand-off: the receiving office's own
        // contact is typed in when the papers arrive there.
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and(chainStep($request, 2)->received_by_name)->toBeNull()
        ->and(chainStep($request, 2)->received_at)->toBeNull()
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and($request->refresh()->current_office_id)->toBe($offices[1]->id)
        ->and($request->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS);

    expect(AuditLog::where('action', 'Approval Forwarded')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();

    // The destination row now takes names, and recording its receiver stamps
    // the date received there.
    $this->patch(route('approval-requests.receive', $request), [
        'received_by_name' => 'Accounting Clerk',
    ])->assertRedirect();

    expect(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED)
        ->and(chainStep($request, 2)->received_by_name)->toBe('Accounting Clerk')
        ->and(chainStep($request, 2)->received_at)->not->toBeNull();
});

it('completes the chain when the only office left ahead is deactivated', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 3);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Accounting Head',
    ])->assertRedirect();

    // The only office still ahead is deactivated: no destination remains, so
    // releasing the papers at the last effective office closes the chain.
    $offices[2]->update(['is_active' => false]);

    $this->patch(route('approval-requests.forward', $request))
        ->assertRedirect()
        ->assertSessionMissing('errors');

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED);
});

it('refuses to write to a row the papers have not reached yet', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    // A pointer that has drifted ahead of the papers (a manual correction
    // elsewhere, say) must not let the runtime date a hand-off that never
    // happened.
    $request->update(['current_office_id' => $offices[1]->id]);

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Accounting Head'])
        ->assertStatus(422);

    expect(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and(chainStep($request, 2)->approved_by_name)->toBeNull();
});

it('skips deactivated offices when forwarding and keeps their history intact', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $offices[1]->update(['is_active' => false]);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    expect($request->refresh()->current_office_id)->toBe($offices[2]->id)
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_PENDING)
        ->and(chainStep($request, 3)->status)->toBe(ApprovalRequestStep::STATUS_PENDING);
});

it('completes a procurement chain when the final office approves', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Budget Officer'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Accounting Head'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Accounting Officer'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head'])->assertRedirect();

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

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request))->assertRedirect();

    // Sitting at the final office without its approval: the pointer must not move.
    $this->patch(route('approval-requests.forward', $request))->assertStatus(422);

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS)
        ->and($request->current_office_id)->toBe($offices[1]->id)
        ->and(chainStep($request, 2)->status)->toBe(ApprovalRequestStep::STATUS_PENDING);
});

it('closes the chain instead of stranding a request when no active office is left ahead', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Budget Officer'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Accounting Head'])->assertRedirect();

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

it('returns a request and then stops the chain', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow);

    // The office sending it back has to be named; nothing else travels with it.
    $this->actingAs($user)
        ->patch(route('approval-requests.return', $request))
        ->assertSessionHasErrors('approved_by_name');

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_IN_PROGRESS);

    $this->patch(route('approval-requests.return', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect(route('subscriptions.show', $subscription));

    $request->refresh();

    expect($request->status)->toBe(ApprovalRequest::STATUS_RETURNED)
        ->and($request->decided_by)->toBe($user->id)
        ->and(chainStep($request, 1)->status)->toBe(ApprovalRequestStep::STATUS_RETURNED)
        ->and(chainStep($request, 1)->approved_by_name)->toBe('Budget Head');

    // A returned request can no longer travel.
    $this->patch(route('approval-requests.approve', $request))->assertStatus(403);
    $this->patch(route('approval-requests.forward', $request))->assertStatus(403);

    expect(AuditLog::where('action', 'Approval Returned')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();
});

it('stamps the date received when the receiver is first recorded', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request] = chainSubscription($flow);

    $this->actingAs($user)
        ->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Records Clerk'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $received = chainStep($request, 1);
    $stamped = $received->received_at?->toDateTimeString();

    expect($received->status)->toBe(ApprovalRequestStep::STATUS_RECEIVED)
        ->and($received->received_by_name)->toBe('Records Clerk')
        ->and($stamped)->not->toBeNull();

    expect(AuditLog::where('action', 'Approval Received')
        ->where('auditable_id', $subscription->id)
        ->exists())->toBeTrue();

    // Two days later a spelling correction is saved, but the recorded date
    // stays where it was: only the first fill stamps it.
    $this->travel(2)->days();

    $this->patch(route('approval-requests.receive', $request), ['received_by_name' => 'Records Clerk Jr'])
        ->assertRedirect();

    $corrected = chainStep($request, 1);

    expect($corrected->received_by_name)->toBe('Records Clerk Jr')
        ->and($corrected->received_at?->toDateTimeString())->toBe($stamped);
});

it('forbids acting on a request that is no longer in progress', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [$subscription, $request, $offices] = chainSubscription($flow, 1);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED);

    $this->patch(route('approval-requests.approve', $request))->assertStatus(403);
    $this->patch(route('approval-requests.forward', $request))->assertStatus(403);
    $this->patch(route('approval-requests.return', $request), ['approved_by_name' => 'Budget Head'])->assertStatus(403);
});

it('renders the styled 403 page when acting on a decided request', function () {
    $user = chainReviewer();
    $flow = ApprovalFlow::factory()->create();
    [, $request] = chainSubscription($flow, 1);

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), [
        'approved_by_name' => 'Budget Head',
    ])->assertRedirect();

    $this->actingAs($user)
        ->patch(route('approval-requests.approve', $request))
        ->assertForbidden()
        ->assertInertia(fn ($page) => $page
            ->component('errors/403')
            ->where('status', 403));
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

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Budget Officer'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head'])->assertRedirect();

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

    $this->actingAs($user)->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Budget Head'])->assertRedirect();
    $this->patch(route('approval-requests.forward', $request), ['sent_by_name' => 'Budget Officer'])->assertRedirect();
    $this->patch(route('approval-requests.approve', $request), ['approved_by_name' => 'Agency Head'])->assertRedirect();

    $subscription->refresh();

    expect($request->refresh()->status)->toBe(ApprovalRequest::STATUS_COMPLETED)
        ->and((string) $subscription->cost)->toBe($originalCost)
        ->and($subscription->renewal_date->toDateString())->toBe($originalDate)
        ->and($subscription->status)->toBe('pending_approval');
});
