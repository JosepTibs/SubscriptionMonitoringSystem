<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {

        $admin =
            ['fname' => 'John', 'lname' => 'Administrator', 'username' => 'administrator.j'];

        $index = (int) $admin;

        User::updateOrCreate(
            ['email' => 'admin'.(1).'@example.com'],
            [
                'username' => $admin['username'],
                'fname' => $admin['fname'],
                'lname' => $admin['lname'],
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
            ]
        );
    }
}
