<?php

namespace Database\Factories;

use App\Models\ApprovalRequest;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalRequest>
 */
class ApprovalRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'subscription_id' => Subscription::factory(),
            'type' => ApprovalRequest::TYPE_PROCUREMENT,
            'status' => ApprovalRequest::STATUS_IN_PROGRESS,
        ];
    }
}
