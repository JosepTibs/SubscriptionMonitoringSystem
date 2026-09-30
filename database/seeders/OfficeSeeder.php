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
            ['name' => 'ICT', 'sort_order' => 10],
            ['name' => 'BUDGET', 'sort_order' => 20],
            ['name' => 'ADMIN', 'sort_order' => 30],
        ];

        foreach ($chain as $office) {
            Office::updateOrCreate(
                ['name' => $office['name']],
                ['sort_order' => $office['sort_order'], 'is_active' => true]
            );
        }
    }
}
