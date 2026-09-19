<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Services\AuditTrail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RenewalsController extends Controller
{
    /**
     * Show the renewal review form for a subscription.
     */
    public function create(Subscription $subscription): Response
    {
        $suggestedRenewalDate = $subscription->billing_interval_unit === 'month'
            ? $subscription->renewal_date->copy()->addMonths($subscription->billing_interval)
            : $subscription->renewal_date->copy()->addYears($subscription->billing_interval);

        return Inertia::render('renewals/create', [
            'subscription' => $subscription->load(['office', 'owner']),
            'suggested_renewal_date' => $suggestedRenewalDate->toDateString(),
            'suggested_cost' => $subscription->cost,
        ]);
    }

    /**
     * Record a renewal review decision for a subscription.
     */
    public function store(Request $request, Subscription $subscription): RedirectResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'in:renewed,cancelled,pending'],
            'new_renewal_date' => ['nullable', 'date', 'required_if:decision,renewed'],
            'new_cost' => ['nullable', 'numeric', 'min:0', 'required_if:decision,renewed'],
            'remarks' => ['nullable', 'string'],
        ]);

        $renewal = $subscription->renewals()->create([
            'previous_renewal_date' => $subscription->renewal_date,
            'new_renewal_date' => $validated['new_renewal_date'] ?? null,
            'previous_cost' => $subscription->cost,
            'new_cost' => $validated['new_cost'] ?? null,
            'decision' => $validated['decision'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'remarks' => $validated['remarks'] ?? null,
        ]);

        if ($validated['decision'] === 'renewed') {
            $subscription->update([
                'renewal_date' => $validated['new_renewal_date'],
                'cost' => $validated['new_cost'],
                'status' => 'active',
            ]);
        } elseif ($validated['decision'] === 'cancelled') {
            $subscription->update(['status' => 'cancelled']);
        }

        AuditTrail::record(
            user: $request->user(),
            action: 'Renewal Reviewed',
            auditable: $subscription,
            oldValues: [
                'renewal_date' => $renewal->previous_renewal_date?->toDateString(),
                'cost' => (string) $renewal->previous_cost,
            ],
            newValues: [
                'decision' => $validated['decision'],
                'renewal_date' => $validated['new_renewal_date'] ?? null,
                'cost' => $validated['new_cost'] ?? null,
            ],
            description: 'Renewal review for "'.$subscription->name.'": '.$validated['decision'],
        );

        return to_route('subscriptions.show', $subscription);
    }
}
