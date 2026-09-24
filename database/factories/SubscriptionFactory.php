<?php

namespace Database\Factories;

use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = fake()->dateTimeBetween('-1 year', 'now');

        return [
            'provider' => fake()->company(),
            'name' => fake()->words(asText: true),
            'cost' => fake()->randomFloat(2, 100, 50000),
            'billing_interval' => 1,
            'billing_interval_unit' => fake()->randomElement(['month', 'year']),
            'start_date' => $start,
            'renewal_date' => $start,
            'status' => 'active',
            'description' => fake()->optional()->sentence(),
        ];
    }
}
