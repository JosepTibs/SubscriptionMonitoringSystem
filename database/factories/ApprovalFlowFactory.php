<?php

namespace Database\Factories;

use App\Models\ApprovalFlow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalFlow>
 */
class ApprovalFlowFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(asText: true),
            'description' => fake()->optional()->sentence(),
            'is_default' => false,
        ];
    }

    /**
     * Flow flagged as the default (exclusivity is enforced by the model boot hook).
     */
    public function default(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_default' => true,
        ]);
    }
}
