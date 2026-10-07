<?php

use App\Models\AuditLog;
use App\Models\Model_has_roles;
use App\Models\Roles;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;

function autoArchiveAdmin(): User
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

function autoArchivedAudits(Subscription $subscription): int
{
    return AuditLog::where('action', 'Subscription Archived')
        ->where('auditable_id', $subscription->id)
        ->count();
}

it('archives a subscription the moment it is cancelled', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->actingAs($user)
        ->patch(route('subscriptions.cancel', $subscription))
        ->assertRedirect(route('subscriptions.show', $subscription));

    $subscription->refresh();

    expect($subscription->status)->toBe('cancelled')
        ->and($subscription->archived_at)->not->toBeNull();

    expect(AuditLog::where('action', 'Subscription Archived')
        ->where('auditable_id', $subscription->id)
        ->whereNull('user_id')
        ->exists())->toBeTrue();
});

it('archives a subscription when a renewal decision cancels it', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->actingAs($user)
        ->post(route('subscriptions.renewals.store', $subscription), ['decision' => 'cancelled'])
        ->assertRedirect(route('subscriptions.show', $subscription));

    $subscription->refresh();

    expect($subscription->status)->toBe('cancelled')
        ->and($subscription->archived_at)->not->toBeNull();
});

it('archives a subscription the moment it becomes suspended through the edit form', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->actingAs($user)
        ->patch(route('subscriptions.update', $subscription), [
            'provider' => $subscription->provider,
            'name' => $subscription->name,
            'cost' => $subscription->cost,
            'billing_interval' => 1,
            'billing_interval_unit' => 'month',
            'start_date' => '2026-01-01',
            'renewal_date' => '2026-11-01',
            'status' => 'suspended',
        ])
        ->assertRedirect(route('subscriptions.show', $subscription));

    expect($subscription->refresh()->archived_at)->not->toBeNull();
});

it('leaves a subscription marked expired alone — the observer only reacts to cancelled and suspended', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create([
        'status' => 'active',
        'renewal_date' => Carbon::today()->subDays(10),
    ]);

    $this->actingAs($user)
        ->patch(route('subscriptions.update', $subscription), [
            'provider' => $subscription->provider,
            'name' => $subscription->name,
            'cost' => $subscription->cost,
            'billing_interval' => 1,
            'billing_interval_unit' => 'month',
            'start_date' => '2026-01-01',
            'renewal_date' => Carbon::today()->subDays(10)->toDateString(),
            'status' => 'expired',
        ])
        ->assertRedirect(route('subscriptions.show', $subscription));

    expect($subscription->refresh()->archived_at)->toBeNull();

    $this->get(route('subscriptions.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $subscription->id));
});

it('treats an expired subscription as archived by date alone, before anything is written', function () {
    Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(20),
    ]);

    expect(Subscription::notArchived()->count())->toBe(0)
        ->and(Subscription::archived()->count())->toBe(1);
});

it('hides a stale expired subscription from the active list and audits it after one load', function () {
    $user = User::factory()->create();
    $stale = Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(20),
    ]);
    $fresh = Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(5),
    ]);

    $this->actingAs($user)
        ->get(route('subscriptions.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $fresh->id));

    expect($stale->refresh()->archived_at)->not->toBeNull()
        ->and($fresh->refresh()->archived_at)->toBeNull();

    expect(AuditLog::where('action', 'Subscription Archived')
        ->where('auditable_id', $stale->id)
        ->whereNull('user_id')
        ->exists())->toBeTrue();
});

it('shows the stale expired subscription in the archived view', function () {
    $user = User::factory()->create();
    Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(20),
    ]);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['show' => 'archived']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1));
});

it('stamps and audits a stale subscription only once across repeated list loads', function () {
    $user = User::factory()->create();
    $stale = Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(20),
    ]);

    $this->actingAs($user)->get(route('subscriptions.index'));
    $this->actingAs($user)->get(route('subscriptions.index'));

    expect(autoArchivedAudits($stale))->toBe(1);
});

it('leaves a manually unarchived cancelled subscription alone on later list loads', function () {
    $this->actingAs(autoArchiveAdmin());
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->patch(route('subscriptions.cancel', $subscription))->assertRedirect();
    expect($subscription->refresh()->archived_at)->not->toBeNull();

    $this->patch(route('subscriptions.unarchive', $subscription))->assertRedirect();
    expect($subscription->refresh()->archived_at)->toBeNull();

    $this->get(route('subscriptions.index'))->assertOk();
    $this->get(route('subscriptions.index', ['show' => 'archived']))->assertOk();

    expect($subscription->refresh()->archived_at)->toBeNull();
});

it('re-archives a stale expired subscription on the next list load after unarchiving', function () {
    $this->actingAs(autoArchiveAdmin());
    $subscription = Subscription::factory()->create([
        'status' => 'expired',
        'renewal_date' => Carbon::today()->subDays(20),
    ]);

    $this->get(route('subscriptions.index'));
    expect($subscription->refresh()->archived_at)->not->toBeNull();

    $this->patch(route('subscriptions.unarchive', $subscription))->assertRedirect();
    expect($subscription->refresh()->archived_at)->toBeNull();

    $this->get(route('subscriptions.index'));
    expect($subscription->refresh()->archived_at)->not->toBeNull();
});

it('does not re-archive or re-audit when an unrelated field changes', function () {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->actingAs($user)->patch(route('subscriptions.cancel', $subscription));
    expect($subscription->refresh()->archived_at)->not->toBeNull();

    $subscription->update(['cost' => '4321']);

    expect(autoArchivedAudits($subscription))->toBe(1);
});

it('skips the auto-archive audit when the subscription was already archived manually', function () {
    $this->actingAs(autoArchiveAdmin());
    $subscription = Subscription::factory()->create(['status' => 'active']);

    $this->patch(route('subscriptions.archive', $subscription))->assertRedirect();
    $this->patch(route('subscriptions.cancel', $subscription))->assertRedirect();

    expect($subscription->refresh()->status)->toBe('cancelled');

    expect(AuditLog::where('action', 'Subscription Archived')
        ->where('auditable_id', $subscription->id)
        ->whereNull('user_id')
        ->exists())->toBeFalse();
});
