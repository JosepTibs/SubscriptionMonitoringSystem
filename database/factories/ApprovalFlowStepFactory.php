<?php

namespace Database\Factories;

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\Office;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalFlowStep>
 */
class ApprovalFlowStepFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'approval_flow_id' => ApprovalFlow::factory(),
            'office_id' => Office::factory(),
            'step_order' => fake()->numberBetween(1, 10),
        ];
    }
}
