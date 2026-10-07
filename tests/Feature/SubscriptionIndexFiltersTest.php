<?php

use App\Models\Owner;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;

it('redirects guests away from the subscription list', function () {
    $this->get(route('subscriptions.index'))->assertRedirect(route('login'));
});

it('filters subscriptions by name or provider search', function () {
    $user = User::factory()->create();
    // Renewal dates pinned so the list order (ascending by renewal) is stable.
    $matchByName = Subscription::factory()->create([
        'name' => 'Adobe Creative Cloud',
        'provider' => 'Other Co',
        'renewal_date' => Carbon::today()->subDays(10),
    ]);
    $matchByProvider = Subscription::factory()->create([
        'name' => 'Office suite',
        'provider' => 'Adobe Inc',
        'renewal_date' => Carbon::today()->subDays(5),
    ]);
    Subscription::factory()->create(['name' => 'Netflix', 'provider' => 'Netflix Inc']);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['search' => 'adobe']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 2)
            ->where('subscriptions.0.id', $matchByName->id)
            ->where('subscriptions.1.id', $matchByProvider->id)
            ->where('filters.search', 'adobe'));
});

it('filters subscriptions by status', function () {
    $user = User::factory()->create();
    Subscription::factory()->create(['status' => 'active']);
    // Renewal pinned inside the 14-day grace period: stale expired rows
    // are archived by derivation and would vanish from the active view.
    $expired = Subscription::factory()->create(['status' => 'expired', 'renewal_date' => Carbon::today()]);
    Subscription::factory()->create(['status' => 'pending_approval']);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['status' => 'expired']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $expired->id)
            ->where('filters.status', 'expired'));
});

it('filters subscriptions by renewal window', function () {
    $user = User::factory()->create();
    $overdue = Subscription::factory()->create(['renewal_date' => Carbon::today()->subDays(5)]);
    Subscription::factory()->create(['renewal_date' => Carbon::today()->addDays(60)]);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['due' => 'overdue']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $overdue->id)
            ->where('filters.due', 'overdue'));
});

it('keeps subscriptions renewing today inside the next-30-days window', function () {
    $user = User::factory()->create();
    $dueToday = Subscription::factory()->create(['renewal_date' => Carbon::today()]);
    Subscription::factory()->create(['renewal_date' => Carbon::today()->addDays(31)]);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['due' => 'next_30']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $dueToday->id));
});

it('filters subscriptions by owner and clears with all', function () {
    $user = User::factory()->create();
    $owner = Owner::factory()->create();
    Subscription::factory()->create(['owner_id' => null]);
    $owned = Subscription::factory()->create(['owner_id' => $owner->id]);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['owner_id' => $owner->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('subscriptions.0.id', $owned->id)
            ->where('filters.owner_id', (string) $owner->id));

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['owner_id' => 'all']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('subscriptions', 2));
});

it('combines filters with the archived view', function () {
    $user = User::factory()->create();
    Subscription::factory()->create(['status' => 'expired', 'archived_at' => now()]);
    // Kept inside the grace period so derivation does not pull it into the view.
    Subscription::factory()->create(['status' => 'expired', 'renewal_date' => Carbon::today()->subDays(5)]);
    Subscription::factory()->create(['status' => 'active', 'archived_at' => now()]);

    $this->actingAs($user)
        ->get(route('subscriptions.index', ['status' => 'expired', 'show' => 'archived']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 1)
            ->where('filters.show', 'archived'));
});

it('leaves subscriptions with no renewal date out of every renewal window', function () {
    $user = User::factory()->create();
    Subscription::factory()->create(['renewal_date' => null]);
    $dueSoon = Subscription::factory()->create(['renewal_date' => Carbon::today()->addDays(10)]);

    // Not overdue, so only the two forward windows can match - and neither
    // should pick up the null-date row.
    $this->actingAs($user)
        ->get(route('subscriptions.index', ['due' => 'overdue']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('subscriptions/index')
            ->has('subscriptions', 0));

    foreach (['next_30', 'next_90'] as $window) {
        $this->actingAs($user)
            ->get(route('subscriptions.index', ['due' => $window]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('subscriptions/index')
                ->has('subscriptions', 1)
                ->where('subscriptions.0.id', $dueSoon->id));
    }
});
