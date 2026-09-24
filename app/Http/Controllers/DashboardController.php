<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the monitoring dashboard.
     */
    public function index(): Response
    {
        $today = Carbon::today();
        $inThirtyDays = $today->copy()->addDays(30);
        $inSixtyDays = $today->copy()->addDays(60);

        $baseQuery = Subscription::query()->whereNot('status', 'cancelled');

        $stats = [
            'active' => (clone $baseQuery)->where('status', 'active')->count(),
            'expiring_soon' => (clone $baseQuery)
                ->where('status', 'active')
                ->whereBetween('renewal_date', [$today->toDateString(), $inThirtyDays->toDateString()])
                ->count(),
            'overdue' => (clone $baseQuery)
                ->where('status', 'active')
                ->where('renewal_date', '<', $today->toDateString())
                ->count(),
            'total_cost' => (string) (clone $baseQuery)->sum('cost'),
        ];

        $dueInOneMonth = Subscription::query()
            ->with(['office', 'owner'])
            ->where('status', 'active')
            ->where('renewal_date', '<=', $inThirtyDays->toDateString())
            ->orderBy('renewal_date')
            ->limit(10)
            ->get()
            ->each(function (Subscription $subscription) use ($today): void {
                $subscription->days_until_renewal = $today->diffInDays($subscription->renewal_date, false);
            });

        $dueInTwoMonths = Subscription::query()
            ->with(['office', 'owner'])
            ->where('status', 'active')
            ->where('renewal_date', '<=', $inSixtyDays->toDateString())
            ->orderBy('renewal_date')
            ->limit(10)
            ->get()
            ->each(function (Subscription $subscription) use ($today): void {
                $subscription->days_until_renewal = $today->diffInDays($subscription->renewal_date, false);
            });

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'dueInOneMonth' => $dueInOneMonth,
            'dueInTwoMonths' => $dueInTwoMonths,
        ]);
    }
}
