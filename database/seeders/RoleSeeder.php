<?php

namespace Database\Seeders;

use App\Models\Roles;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        //

        $adminrole = ['name' => 'admin', 'guard_name' => 'web'];

        Roles::create($adminrole);
    }
}
