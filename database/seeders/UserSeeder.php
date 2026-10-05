<?php

namespace Database\Seeders;

use App\Models\Model_has_roles;
use App\Models\Roles;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * One account per role, so each privilege level can be exercised: the
     * Superadmin and Admin may correct or erase trail entries, the Member is
     * the regular ICT encoder.
     *
     * @var list<array{username: string, fname: string, lname: string, email: string, role: string}>
     */
    private const ACCOUNTS = [
        [
            'username' => 'superadmin.j',
            'fname' => 'Jane',
            'lname' => 'Superadmin',
            'email' => 'superadmin@example.com',
            'role' => 'Superadmin',
        ],
        [
            'username' => 'administrator.j',
            'fname' => 'John',
            'lname' => 'Administrator',
            'email' => 'admin1@example.com',
            'role' => 'Admin',
        ],
        [
            'username' => 'member.j',
            'fname' => 'Maria',
            'lname' => 'Member',
            'email' => 'member1@example.com',
            'role' => 'Member',
        ],
    ];

    public function run(): void
    {
        foreach (self::ACCOUNTS as $account) {

            $user = User::updateOrCreate(
                [

                    'username' => $account['username'],
                    'fname' => $account['fname'],
                    'lname' => $account['lname'],
                    'password' => bcrypt('password'),
                    'email_verified_at' => now(),
                ]
            );

            $this->assignRole($user, $account['role']);
        }
    }

    /**
     * Attach the role through the morph pivot. Any previous role is dropped
     * first so re-seeding a demotion actually takes effect.
     */
    private function assignRole(User $user, string $roleName): void
    {
        $role = Roles::query()->where('name', $roleName)->first();

        if ($role === null) {
            return;
        }

        Model_has_roles::query()
            ->where('model_type', User::class)
            ->where('model_id', $user->id)
            ->delete();

        Model_has_roles::create([
            'role_id' => $role->id,
            'model_type' => User::class,
            'model_id' => $user->id,
        ]);
    }
}
