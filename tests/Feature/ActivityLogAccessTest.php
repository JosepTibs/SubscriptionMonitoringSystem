<?php

use App\Models\Model_has_roles;
use App\Models\Roles;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * Builds an account holding the given role. The pivot row is written directly
 * because roles()->create() does not match the pivot schema (the same
 * workaround ArchiveDeleteTest uses).
 */
function activityLogViewer(string $role): User
{
    $user = User::factory()->create();
    $record = Roles::create(['name' => $role, 'guard_name' => 'web']);

    Model_has_roles::create([
        'role_id' => $record->id,
        'model_type' => User::class,
        'model_id' => $user->id,
    ]);

    return $user->refresh()->load('roles');
}

it('shares the acting account roles with the client in lowercase', function () {
    // The role is stored capitalised to prove the shared payload normalises it.
    $this->actingAs(activityLogViewer('Admin'));

    $this->get(route('activity-logs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.roles', ['admin'])
            ->where('auth.can_manage_records', true));
});

it('blocks the activity trail for accounts without an administrative role', function () {
    $this->actingAs(activityLogViewer('encoder'));

    $this->get(route('activity-logs.index'))->assertForbidden();
});
