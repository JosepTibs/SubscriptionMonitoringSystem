<?php

namespace App\Observers;

use App\Models\Subscription;
use App\Services\AuditTrail;

class SubscriptionObserver
{
    /**
     * Archive the subscription the moment it becomes cancelled or
     * suspended. Expired rows are deliberately left alone — they stay
     * visible until someone archives them by hand.
     */
    public function updated(Subscription $subscription): void
    {
        if (! $subscription->wasChanged('status')) {
            return;
        }

        if (! in_array($subscription->status, ['cancelled', 'suspended'], true)) {
            return;
        }

        // Already archived manually — leave it as the user left it.
        if ($subscription->isArchived()) {
            return;
        }

        $subscription->archive();

        AuditTrail::record(
            user: null,
            action: 'Subscription Archived',
            auditable: $subscription,
            newValues: ['archived_at' => $subscription->archived_at?->toDateTimeString()],
            description: 'Auto-archived subscription "'.$subscription->name.'" because it is '.$subscription->status.'.',
        );
    }
}
