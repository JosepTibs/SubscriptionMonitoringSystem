<?php

use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Model_has_roles;
use App\Models\Roles;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;

uses(RefreshDatabase::class);

function archiveAdmin(): User
{
    $admin = User::factory()->create();
    $role = Roles::create(['name' => 'admin', 'guard_name' => 'web']);

    Model_has_roles::create([
        'role_id' => $role->id,
        'model_type' => User::class,
        'model_id' => $admin->id,
    ]);

    return $admin->refresh()->load('roles');
}

function archiveEncoder(): User
{
    $encoder = User::factory()->create();
    $role = Roles::create(['name' => 'encoder', 'guard_name' => 'web']);

    Model_has_roles::create([
        'role_id' => $role->id,
        'model_type' => User::class,
        'model_id' => $encoder->id,
    ]);

    return $encoder->refresh()->load('roles');
}

it('archives and unarchives a subscription without deleting it', function () {
    $this->actingAs(archiveAdmin());

    $subscription = Subscription::factory()->create(['name' => 'Netflix']);

    $this->patch(route('subscriptions.archive', $subscription))->assertRedirect();
    expect($subscription->refresh()->isArchived())->toBeTrue();

    $this->get(route('subscriptions.index'))->assertOk();
    $this->get(route('subscriptions.index', ['show' => 'archived']))->assertOk();

    $this->patch(route('subscriptions.unarchive', $subscription))->assertRedirect();
    expect($subscription->refresh()->isArchived())->toBeFalse();
});

it('blocks subscription deletes while a chain is travelling', function () {
    $this->actingAs(archiveAdmin());

    $subscription = Subscription::factory()->create(['name' => 'Netflix']);
    $request = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'status' => ApprovalRequest::STATUS_IN_PROGRESS,
    ]);

    $this->delete(route('subscriptions.destroy', $subscription))->assertStatus(422);
    expect(Subscription::find($subscription->id))->not->toBeNull();

    $request->update(['status' => ApprovalRequest::STATUS_COMPLETED]);

    $this->delete(route('subscriptions.destroy', $subscription))->assertRedirect();
    expect(Subscription::find($subscription->id))->toBeNull();
    expect(ApprovalRequest::find($request->id))->toBeNull();
});

it('forbids archive and delete for non-admin accounts', function () {
    $this->actingAs(archiveEncoder());

    $subscription = Subscription::factory()->create(['name' => 'Netflix']);
    $request = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'status' => ApprovalRequest::STATUS_COMPLETED,
    ]);
    $victim = User::factory()->create();

    $this->patch(route('subscriptions.archive', $subscription))->assertForbidden();
    $this->delete(route('subscriptions.destroy', $subscription))->assertForbidden();
    $this->patch(route('approval-requests.archive', $request))->assertForbidden();
    $this->delete(route('approval-requests.destroy', $request))->assertForbidden();
    $this->patch(route('users.archive', $victim))->assertForbidden();
    $this->delete(route('users.destroy', $victim))->assertForbidden();
});

it('archives a user and blocks their login until unarchived', function () {
    $this->actingAs(archiveAdmin());

    $victim = User::factory()->create(['email' => 'archived@example.com']);

    $this->patch(route('users.archive', $victim))->assertRedirect();
    expect($victim->refresh()->isArchived())->toBeTrue();

    Auth::logout();
    $this->post(route('login'), ['email' => 'archived@example.com', 'password' => 'password'])
        ->assertSessionHasErrors('email');

    $this->actingAs(User::where('email', '!=', 'archived@example.com')->firstOrFail());
    $this->patch(route('users.unarchive', $victim))->assertRedirect();
    expect($victim->refresh()->isArchived())->toBeFalse();
});

it('archives a finished approval request and deletes it with its steps', function () {
    $this->actingAs(archiveAdmin());

    $subscription = Subscription::factory()->create(['name' => 'Netflix']);
    $live = ApprovalRequest::factory()->create([
        'subscription_id' => $subscription->id,
        'status' => ApprovalRequest::STATUS_IN_PROGRESS,
    ]);

    $this->delete(route('approval-requests.destroy', $live))->assertStatus(422);

    $live->update(['status' => ApprovalRequest::STATUS_COMPLETED]);

    $this->patch(route('approval-requests.archive', $live))->assertRedirect();
    expect($live->refresh()->isArchived())->toBeTrue();

    $this->patch(route('approval-requests.unarchive', $live))->assertRedirect();
    expect($live->refresh()->isArchived())->toBeFalse();

    $stepIds = $live->steps()->pluck('id')->all();

    $this->delete(route('approval-requests.destroy', $live))->assertRedirect();
    expect(ApprovalRequest::find($live->id))->toBeNull();
    foreach ($stepIds as $stepId) {
        expect(ApprovalRequestStep::find($stepId))->toBeNull();
    }
});
