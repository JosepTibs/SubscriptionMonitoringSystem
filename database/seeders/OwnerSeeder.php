<?php

namespace Database\Seeders;

use App\Models\Owner;
use Illuminate\Database\Seeder;

class OwnerSeeder extends Seeder
{
    /**
     * Default approval chain. Gaps of 10 allow inserting offices later
     * without renumbering. Reorder = update sort_order, no code change.
     */
    public function run(): void
    {
        $chain = [
            ['name' => 'Software Development'],
            ['name' => 'Quality Assurance'],
            ['name' => 'Database Management'],
            ['name' => 'Network Admin'],
            ['name' => 'Technicals'],
        ];

        foreach ($chain as $owner) {
            Owner::updateOrCreate(
                ['name' => $owner['name']]

            );
        }
    }
}
