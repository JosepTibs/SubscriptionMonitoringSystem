<?php

namespace Database\Seeders;

use App\Models\Roles;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * The roles the system recognises, highest privilege first.
     *
     * Superadmin and Admin may correct or erase entries already recorded in an
     * approval trail; Member is the regular ICT encoder, who fills the trail
     * but cannot rewrite what an office already answered for.
     *
     * Names are TitleCase because UserController compares against
     * 'Superadmin' when deciding which roles may be assigned.
     *
     * @var list<string>
     */
    public const ROLES = ['Superadmin', 'Admin', 'Member'];

    public function run(): void
    {
        foreach (self::ROLES as $name) {
            Roles::updateOrCreate(
                ['name' => $name],
                ['guard_name' => 'web'],
            );
        }
    }
}
