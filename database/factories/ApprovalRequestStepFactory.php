<?php

namespace Database\Factories;

use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalRequestStep>
 */
class ApprovalRequestStepFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'approval_request_id' => ApprovalRequest::factory(),
            'office_id' => Office::factory(),
            'step_order' => fake()->numberBetween(1, 10),
            'status' => ApprovalRequestStep::STATUS_PENDING,
        ];
    }
}
