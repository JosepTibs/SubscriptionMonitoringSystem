<?php

namespace App\Console\Commands;

use App\Mail\RenewalDeadlineDigestMail;
use App\Models\Subscription;
use App\Services\AdminNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Mails administrators a single digest of the subscriptions whose renewal
 * deadline is one or two months out, grouped by how much time is left.
 *
 * Each subscription is reported once per window it has entered: the pair is
 * remembered in the cache for monitoring.dedupe_ttl, so a second run on the
 * same day cannot duplicate a mail, while a subscription that stays inside the
 * same window for a week is not repeated either.
 */
class SendDeadlineReminders extends Command
{
    /**
     * @var string
     */
    protected $signature = 'subscriptions:send-deadline-reminders';

    /**
     * @var string
     */
    protected $description = 'Email administrators the subscriptions approaching their renewal deadline';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        /** @var list<int> $windows */
        $windows = config('monitoring.deadline_windows', [60, 30, 14]);

        $largestWindow = max($windows);

        $due = Subscription::query()
            ->notArchived()
            ->where('status', 'active')
            ->whereNotNull('renewal_date')
            ->whereBetween('renewal_date', [
                today()->toDateString(),
                today()->addDays($largestWindow)->toDateString(),
            ])
            ->with(['owner'])
            ->orderBy('renewal_date')
            ->get();

        if ($due->isEmpty()) {
            $this->components->info('No subscriptions are within the reminder windows.');

            return self::SUCCESS;
        }

        $groups = $this->groupByWindow($due, $windows);

        if ($groups === []) {
            $this->components->info('Every subscription in range has already been reported.');

            return self::SUCCESS;
        }

        $recipients = AdminNotifier::notifyAdmins(new RenewalDeadlineDigestMail($groups));

        if ($recipients === 0) {
            $this->components->warn('No administrator accounts with an email address were found.');

            return self::SUCCESS;
        }

        $total = collect($groups)->sum(fn (array $group) => $group['subscriptions']->count());

        $this->components->info(sprintf(
            'Queued deadline digest for %d subscription(s) to %d administrator(s).',
            $total,
            $recipients,
        ));

        return self::SUCCESS;
    }

    /**
     * Bucket subscriptions into the closest reminder window each one has
     * entered, dropping any (subscription, window) pair already reported.
     *
     * The days-left count rides on the model so the view can print it without
     * recomputing the window it was bucketed under.
     *
     * @param  Collection<int, Subscription>  $subscriptions
     * @param  list<int>  $windows
     * @return list<array{window: int, subscriptions: Collection<int, Subscription>}>
     */
    private function groupByWindow(Collection $subscriptions, array $windows): array
    {
        $buckets = [];

        foreach ($subscriptions as $subscription) {
            $daysRemaining = (int) today()->diffInDays($subscription->renewal_date);

            // The closest window the subscription has already entered: the
            // smallest configured window that still covers the days left, so a
            // subscription crossing 30 days is reported once, under 30.
            $window = collect($windows)
                ->filter(fn (int $candidate): bool => $daysRemaining <= $candidate)
                ->sort()
                ->first();

            if ($window === null) {
                continue;
            }

            if (! Cache::add(
                "deadline-reminder:{$subscription->id}:{$window}",
                true,
                config('monitoring.dedupe_ttl', 129600),
            )) {
                continue;
            }

            $subscription->setAttribute('days_remaining', $daysRemaining);

            $buckets[$window][] = $subscription;
        }

        $groups = [];

        foreach ($buckets as $window => $items) {
            $groups[] = [
                'window' => (int) $window,
                'subscriptions' => collect($items)->sortBy('days_remaining')->values(),
            ];
        }

        // Ordered by window so the digest always leads with the most urgent
        // block, whatever order the renewal dates happened to arrive in.
        usort($groups, fn (array $a, array $b) => $a['window'] <=> $b['window']);

        return $groups;
    }
}
