<?php

namespace Database\Seeders;

use App\Models\Office;
use Illuminate\Database\Seeder;

class OfficeSeeder extends Seeder
{
    /**
     * Default approval chain. Gaps of 10 allow inserting offices later
     * without renumbering. Reorder = update sort_order, no code change.
     */
    public function run(): void
    {
        $chain = [
            ['name' => 'Requesting Office', 'sort_order' => 10],
            ['name' => 'ICT', 'sort_order' => 20],
            ['name' => 'Budget', 'sort_order' => 30],
            ['name' => 'Accounting', 'sort_order' => 40],
            ['name' => 'Head', 'sort_order' => 50],
        ];

        foreach ($chain as $office) {
            Office::updateOrCreate(
                ['name' => $office['name']],
                ['sort_order' => $office['sort_order'], 'is_active' => true]
            );
        }
    }
}
