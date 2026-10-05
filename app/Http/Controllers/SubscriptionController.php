<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequest;
use App\Models\Office;
use App\Models\Owner;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ApprovalChain;
use App\Services\AuditTrail;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        $today = Carbon::today();
        $show = $request->input('show', 'active');

        $subscriptions = Subscription::query()
            ->when($show === 'archived', fn (Builder $query) => $query->archived(), fn (Builder $query) => $query->notArchived())
            ->where('status', 'not like', '%pending%')
            ->with('office', 'owner')
            // Subscriptions still travelling an approval chain carry no dates
            // yet, so they sit at the bottom until their dates are recorded.
            ->orderByRaw('renewal_date IS NULL')
            ->orderBy('renewal_date')
            ->get()
            ->each(function (Subscription $subscription) use ($today): void {
                $subscription->days_until_renewal = $subscription->renewal_date === null
                    ? null
                    : (int) $today->diffInDays($subscription->renewal_date, false);
            });

        return Inertia::render('subscriptions/index', [
            'subscriptions' => $subscriptions,
            'filters' => ['show' => $show],
            // The create sheet renders the shared subscription form, so the
            // list needs the same option sets the create page was given.
            ...$this->formOptions(),
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
            ...$this->subscriptionRules($request->input('intake_mode') === 'for_approval'),
            'intake_mode' => ['required', 'in:approved,for_approval'],
            // Whitelisted to the two index routes so a caller cannot use this
            // as an open redirect. Omitting it keeps the default redirect to
            // the new subscription.
            'return_to' => ['nullable', Rule::in(['subscriptions.index', 'approvals.index'])],
            // required_if is deliberately NOT used: omitting a flow id falls
            // back to the default flow in the transaction below.
            'approval_flow_id' => ['nullable', 'integer', 'exists:approval_flows,id'],
        ]);

        $returnTo = $validated['return_to'] ?? null;

        [$subscription, $forApproval] = DB::transaction(function () use ($request, $validated): array {
            $forApproval = $validated['intake_mode'] === 'for_approval';
            $flow = null;

            // Neither key is a column on the subscription.
            unset($validated['intake_mode'], $validated['return_to']);

            if ($forApproval) {
                $flow = ($validated['approval_flow_id'] ?? null) !== null
                    ? ApprovalFlow::findOrFail($validated['approval_flow_id'])
                    : ApprovalFlow::defaultFlow();

                abort_unless($flow !== null, 422, 'No default approval flow exists - set one first.');

                $validated['status'] = 'pending_approval';
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

        // The create sheet stays on the list it was opened from; anything else
        // lands on the new subscription, as before.
        if ($returnTo !== null) {
            return to_route($returnTo);
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

        $suggestedRenewalDate = $subscription->renewal_date === null
            ? null
            : ($subscription->billing_interval_unit === 'month'
                ? $subscription->renewal_date->copy()->addMonths($subscription->billing_interval)
                : $subscription->renewal_date->copy()->addYears($subscription->billing_interval));

        return Inertia::render('subscriptions/show', [
            ...$this->formOptions(),
            'subscription' => $subscription,
            'approval_requests' => $subscription->approvalRequests,
            'days_until_renewal' => $subscription->renewal_date === null
                ? null
                : (int) Carbon::today()->diffInDays($subscription->renewal_date, false),
            'suggested_renewal_date' => $suggestedRenewalDate?->toDateString(),
            'suggested_cost' => $subscription->cost,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Subscription $subscription): Response
    {
        $offices = Office::query()->orderBy('name')->get();

        return Inertia::render('subscriptions/edit', [
            'subscription' => [
                'id' => $subscription->id,
                'provider' => $subscription->provider,
                'name' => $subscription->name,
                'cost' => $subscription->cost,
                'billing_interval' => $subscription->billing_interval,
                'billing_interval_unit' => $subscription->billing_interval_unit,
                'start_date' => $subscription->start_date?->format('Y-m-d'),
                'renewal_date' => $subscription->renewal_date?->format('Y-m-d'),
                'office_id' => $subscription->office_id,
                'owner_id' => $subscription->owner_id,
                'approval_flow_id' => $subscription->approval_flow_id,
                'status' => $subscription->status,
                'description' => $subscription->description,
            ],
            'offices' => $offices,
            'owners' => Owner::query()->orderBy('name')->get(),
            'approval_flows' => ApprovalFlow::query()->orderBy('name')->get(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Subscription $subscription): RedirectResponse
    {
        $oldValues = $subscription->only(array_keys($this->subscriptionRules()));

        $subscription->fill($this->validateSubscription($request, $subscription->status === 'pending_approval'));
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
     * Hiding or erasing a subscription is an administrative act: the regular
     * ICT encoder records renewals but never hides or erases a subscription.
     */
    private function requireSubscriptionManager(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user !== null && ($user->hasRole('admin') || $user->hasRole('superadmin')),
            403,
            'Only an administrator can archive or delete a subscription.'
        );
    }

    /**
     * Hide a subscription from the normal list without deleting it.
     */
    public function archive(Request $request, Subscription $subscription): RedirectResponse
    {
        $this->requireSubscriptionManager($request);

        $subscription->archive();

        AuditTrail::record(
            user: $request->user(),
            action: 'Subscription Archived',
            auditable: $subscription,
            newValues: ['archived_at' => $subscription->archived_at?->toDateTimeString()],
            description: 'Archived subscription "'.$subscription->name.'"',
        );

        return back()->with('success', 'Subscription archived.');
    }

    /**
     * Show an archived subscription in the normal list again.
     */
    public function unarchive(Request $request, Subscription $subscription): RedirectResponse
    {
        $this->requireSubscriptionManager($request);

        $subscription->unarchive();

        AuditTrail::record(
            user: $request->user(),
            action: 'Subscription Unarchived',
            auditable: $subscription,
            newValues: ['archived_at' => null],
            description: 'Unarchived subscription "'.$subscription->name.'"',
        );

        return back()->with('success', 'Subscription unarchived.');
    }

    /**
     * Permanently erase a subscription with its renewals and approval history.
     * A subscription with a live chain can only be archived — deleting it
     * would orphan papers in transit.
     */
    public function destroy(Request $request, Subscription $subscription): RedirectResponse
    {
        $this->requireSubscriptionManager($request);

        abort_if(
            $subscription->approvalRequests()->where('status', ApprovalRequest::STATUS_IN_PROGRESS)->exists(),
            422,
            'This subscription has an approval request still travelling. Archive it instead of deleting.'
        );

        $name = $subscription->name;

        $subscription->delete();

        AuditTrail::record(
            user: $request->user(),
            action: 'Subscription Deleted',
            auditable: null,
            oldValues: ['subscription_id' => $subscription->id, 'name' => $name],
            description: 'Deleted subscription "'.$name.'"',
        );

        return to_route('subscriptions.index')->with('success', 'Subscription deleted permanently.');
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
            'owners' => Owner::query()->orderBy('name')->get(),
            'approval_flows' => ApprovalFlow::query()->orderBy('name')->get(),
        ];
    }

    /**
     * Validate the request against the subscription rules.
     *
     * @return array<string, mixed>
     */
    private function validateSubscription(Request $request, bool $datesOptional = false): array
    {
        return $request->validate($this->subscriptionRules($datesOptional));
    }

    /**
     * Validation rules for a subscription.
     *
     * Dates only become mandatory once a subscription is no longer travelling
     * an approval chain: intake for approval creates the record without them,
     * and they are recorded when the chain completes (or on the edit form).
     *
     * @param  bool  $datesOptional  true while the subscription waits on a chain
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    private function subscriptionRules(bool $datesOptional = false): array
    {
        return [
            'provider' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'cost' => ['required', 'numeric', 'min:0'],
            'billing_interval' => ['required', 'integer', 'min:1'],
            'billing_interval_unit' => ['required', 'in:month,year'],
            'start_date' => $datesOptional ? ['nullable', 'date'] : ['required', 'date'],
            'renewal_date' => $datesOptional
                ? ['nullable', 'date', 'after_or_equal:start_date']
                : ['required', 'date', 'after_or_equal:start_date'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
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
