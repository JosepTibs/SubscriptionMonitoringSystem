<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalRequestStep;
use App\Models\Office;
use App\Services\AuditTrail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OfficeController extends Controller
{
    /**
     * Display the combined Offices & Flows screen.
     */
    public function index(): Response
    {
        $offices = Office::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Inertia::render('offices/index', [
            'offices' => $offices,
            'flows' => ApprovalFlow::query()
                ->with('steps.office')
                ->orderBy('name')
                ->get(),
            'next_sort_order' => ((int) Office::max('sort_order')) + 10,
        ]);
    }

    /**
     * Show one office and the history of the subscriptions whose papers it
     * has handled: pending (queued for or sitting at this office), approved
     * (signed off here), released (forwarded onward) and returned (sent
     * back from here).
     */
    public function show(Request $request, Office $office): Response
    {
        $buckets = [
            'pending' => [ApprovalRequestStep::STATUS_PENDING, ApprovalRequestStep::STATUS_RECEIVED],
            'approved' => [ApprovalRequestStep::STATUS_APPROVED],
            'released' => [ApprovalRequestStep::STATUS_FORWARDED],
            'returned' => [ApprovalRequestStep::STATUS_RETURNED],
        ];

        $requested = $request->input('status');
        $filter = is_string($requested) && array_key_exists($requested, $buckets) ? $requested : 'all';

        $counts = [
            'pending' => $office->approvalRequestSteps()->whereIn('status', $buckets['pending'])->count(),
            'approved' => $office->approvalRequestSteps()->where('status', ApprovalRequestStep::STATUS_APPROVED)->count(),
            'released' => $office->approvalRequestSteps()->where('status', ApprovalRequestStep::STATUS_FORWARDED)->count(),
            'returned' => $office->approvalRequestSteps()->where('status', ApprovalRequestStep::STATUS_RETURNED)->count(),
        ];
        $counts['all'] = array_sum($counts);

        $chainPosition = null;

        if ($office->is_active) {
            $position = Office::ordered()->pluck('id')->search($office->id);
            $chainPosition = $position === false ? null : $position + 1;
        }

        return Inertia::render('offices/show', [
            'office' => $office,
            'chain_position' => $chainPosition,
            'history' => $office->approvalRequestSteps()
                ->with([
                    'approvalRequest.flow',
                    'approvalRequest.subscription.owner',
                    'approvalRequest.currentOffice',
                ])
                ->when(
                    $filter !== 'all',
                    fn (Builder $query) => $query->whereIn('status', $buckets[$filter])
                )
                ->orderByRaw('COALESCE(acted_at, received_at, created_at) DESC')
                ->paginate(15)
                ->withQueryString(),
            'counts' => $counts,
            'filters' => $request->only(['status']),
        ]);
    }

    /**
     * Store a newly created office.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:offices,name'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $office = Office::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ((int) Office::max('sort_order')) + 10,
            'is_active' => true,
        ]);

        AuditTrail::record(
            user: $request->user(),
            action: 'Office Created',
            auditable: $office,
            newValues: $office->getAttributes(),
            description: 'Created office "'.$office->name.'"',
        );

        return redirect()->route('offices.index')->with('success', 'Office created successfully.');
    }

    /**
     * Update the specified office.
     */
    public function update(Request $request, Office $office)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('offices', 'name')->ignore($office->id)],
            'description' => ['nullable', 'string'],
        ]);

        $oldValues = $office->only(['name', 'description']);

        $office->update($validated);

        AuditTrail::record(
            user: $request->user(),
            action: 'Office Updated',
            auditable: $office,
            oldValues: $oldValues,
            newValues: $office->only(['name', 'description']),
            description: 'Updated office "'.$office->name.'"',
        );

        return redirect()->route('offices.index')->with('success', 'Office updated successfully.');
    }

    /**
     * Toggle the office's active state. Deactivating removes it from future
     * chain forwards but preserves all history rows.
     */
    public function toggleActive(Request $request, Office $office)
    {
        $oldValues = ['is_active' => $office->is_active];

        $office->update(['is_active' => ! $office->is_active]);

        AuditTrail::record(
            user: $request->user(),
            action: $office->is_active ? 'Office Activated' : 'Office Deactivated',
            auditable: $office,
            oldValues: $oldValues,
            newValues: ['is_active' => $office->is_active],
            description: ($office->is_active ? 'Activated' : 'Deactivated').' office "'.$office->name.'"',
        );

        return redirect()
            ->route('offices.index')
            ->with('success', $office->is_active
                ? 'Office activated successfully.'
                : 'Office deactivated. It is removed from future renewal forwards; history is preserved.');
    }
}
