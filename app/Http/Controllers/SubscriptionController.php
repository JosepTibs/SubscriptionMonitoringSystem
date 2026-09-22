<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequest;
use App\Models\Office;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use App\Services\AuditTrail;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): Response
    {
        $today = Carbon::today();

        $subscriptions = Subscription::query()
            ->with('office', 'owner')
            ->orderBy('renewal_date')
            ->get()
            ->each(function (Subscription $subscription) use ($today): void {
                $subscription->days_until_renewal = (int) $today->diffInDays($subscription->renewal_date, false);
            });

        return Inertia::render('subscriptions/index', [
            'subscriptions' => $subscriptions,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): Response
    {
        return Inertia::render('subscriptions/create', $this->formOptions());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            ...$this->subscriptionRules(),
            'intake_mode' => ['required', 'in:approved,for_approval'],
            // required_if is deliberately NOT used: omitting a flow id falls
            // back to the default flow in the transaction below.
            'approval_flow_id' => ['nullable', 'integer', 'exists:approval_flows,id'],
        ]);

        [$subscription, $forApproval] = DB::transaction(function () use ($request, $validated): array {
            $forApproval = $validated['intake_mode'] === 'for_approval';
            $flow = null;

            if ($forApproval) {
                $flow = ($validated['approval_flow_id'] ?? null) !== null
                    ? ApprovalFlow::findOrFail($validated['approval_flow_id'])
                    : ApprovalFlow::defaultFlow();

                abort_unless($flow !== null, 422, 'No default approval flow exists - set one first.');

                $validated['status'] = 'pending_approval';
                unset($validated['intake_mode']);
            } else {
                unset($validated['intake_mode']);
            }

            $subscription = Subscription::create($validated);

            if ($forApproval) {
                $this->createProcurementRequest($subscription, $flow, $request->user());
            }

            return [$subscription, $forApproval];
        });

        if (! $forApproval) {
            AuditTrail::record(
                user: $request->user(),
                action: 'Subscription Created',
                auditable: $subscription,
                newValues: $subscription->getAttributes(),
                description: 'Created subscription "'.$subscription->name.'"',
            );
        }

        return to_route('subscriptions.show', $subscription);
    }

    /**
     * Display the specified resource.
     */
    public function show(Subscription $subscription): Response
    {
        $subscription->load([
            'office',
            'owner',
            'renewals.reviewer',
            'approvalRequests.flow',
            'approvalRequests.currentOffice',
            'approvalRequests.renewal',
            'approvalRequests.steps.office',
            'approvalRequests.steps.actor',
        ]);

        $suggestedRenewalDate = $subscription->billing_interval_unit === 'month'
            ? $subscription->renewal_date->copy()->addMonths($subscription->billing_interval)
            : $subscription->renewal_date->copy()->addYears($subscription->billing_interval);

        return Inertia::render('subscriptions/show', [
            'subscription' => $subscription,
            'approval_requests' => $subscription->approvalRequests,
            'days_until_renewal' => (int) Carbon::today()->diffInDays($subscription->renewal_date, false),
            'suggested_renewal_date' => $suggestedRenewalDate->toDateString(),
            'suggested_cost' => $subscription->cost,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Subscription $subscription): Response
    {
        return Inertia::render('subscriptions/edit', [
            'subscription' => $subscription,
            ...$this->formOptions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Subscription $subscription): RedirectResponse
    {
        $oldValues = $subscription->only(array_keys($this->subscriptionRules()));

        $subscription->fill($this->validateSubscription($request));
        $subscription->save();

        $changes = collect($subscription->getChanges())->except(['updated_at']);
        $oldChanged = $changes
            ->mapWithKeys(fn (mixed $value, string $key): array => [$key => $oldValues[$key] ?? null])
            ->all();

        AuditTrail::record(
            user: $request->user(),
            action: 'Subscription Updated',
            auditable: $subscription,
            oldValues: $oldChanged,
            newValues: $changes->all(),
            description: 'Updated subscription "'.$subscription->name.'"',
        );

        return to_route('subscriptions.show', $subscription);
    }

    /**
     * Mark the specified subscription as cancelled.
     */
    public function cancel(Request $request, Subscription $subscription): RedirectResponse
    {
        $oldStatus = $subscription->getOriginal('status');

        $subscription->update(['status' => 'cancelled']);

        AuditTrail::record(
            user: $request->user(),
            action: 'Subscription Cancelled',
            auditable: $subscription,
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => 'cancelled'],
            description: 'Cancelled subscription "'.$subscription->name.'"',
        );

        return to_route('subscriptions.show', $subscription);
    }

    /**
     * Dropdown options shared by the create and edit forms.
     *
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'offices' => Office::query()->orderBy('name')->get(),
            'owners' => User::query()->orderBy('id')->get(),
            'approval_flows' => ApprovalFlow::query()->orderBy('name')->get(),
        ];
    }

    /**
     * Validate the request against the subscription rules.
     *
     * @return array<string, mixed>
     */
    private function validateSubscription(Request $request): array
    {
        return $request->validate($this->subscriptionRules());
    }

    /**
     * Validation rules for a subscription.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    private function subscriptionRules(): array
    {
        return [
            'provider' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'cost' => ['required', 'numeric', 'min:0'],
            'billing_interval' => ['required', 'integer', 'min:1'],
            'billing_interval_unit' => ['required', 'in:month,year'],
            'start_date' => ['required', 'date'],
            'renewal_date' => ['required', 'date', 'after_or_equal:start_date'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['required', 'in:active,expired,cancelled,suspended,pending_approval'],
            'approval_flow_id' => ['nullable', 'integer', 'exists:approval_flows,id'],
            'description' => ['nullable', 'string'],
        ];
    }

    private function createProcurementRequest(Subscription $subscription, ApprovalFlow $flow, User $user): ApprovalRequest
    {
        $approvalRequest = ApprovalChain::start($subscription, $flow, ApprovalRequest::TYPE_PROCUREMENT);
        $approvalRequest->load('currentOffice');

        AuditTrail::record(
            user: $user,
            action: 'Subscription Submitted for Approval',
            auditable: $subscription,
            newValues: [
                'status' => 'pending_approval',
                'approval_flow' => $flow->name,
                'current_office' => $approvalRequest->currentOffice?->name,
            ],
            description: 'Submitted subscription "'.$subscription->name.'" for approval via flow "'.$flow->name.'"',
        );

        return $approvalRequest;
    }
}
