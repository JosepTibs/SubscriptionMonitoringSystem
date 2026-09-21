<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Services\AuditTrail;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OfficeController extends Controller
{
    /**
     * Display a listing of offices in chain order.
     */
    public function index(): Response
    {
        $offices = Office::query()
            ->withCount('subscriptions')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Inertia::render('offices/index', [
            'offices' => $offices,
        ]);
    }

    /**
     * Show the form for creating a new office.
     */
    public function create(): Response
    {
        return Inertia::render('offices/create', [
            'next_sort_order' => ((int) Office::max('sort_order')) + 10,
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
     * Show the form for editing the specified office.
     */
    public function edit(Office $office): Response
    {
        return Inertia::render('offices/edit', [
            'office' => $office,
        ]);
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

    /**
     * Swap the office's position in the approval chain with the adjacent
     * active office. Only sort_order values are swapped so the gap-of-10
     * scheme is preserved.
     */
    public function move(Request $request, Office $office)
    {
        $validated = $request->validate([
            'direction' => ['required', 'in:up,down'],
        ]);

        $chain = Office::ordered()->get(['id', 'sort_order'])->values();

        $currentIndex = $chain->search(fn (Office $item) => $item->id === $office->id);

        if ($currentIndex === false) {
            return redirect()->route('offices.index')->with('error', 'Inactive offices cannot be reordered. Activate the office first.');
        }

        $targetIndex = $validated['direction'] === 'up' ? $currentIndex - 1 : $currentIndex + 1;

        if ($targetIndex < 0 || $targetIndex >= $chain->count()) {
            return redirect()->route('offices.index')->with('error', 'The office is already at the end of the chain.');
        }

        $currentSortOrder = $chain[$currentIndex]->sort_order;
        $target = $chain[$targetIndex];

        $chain[$currentIndex]->update(['sort_order' => $target->sort_order]);
        $target->update(['sort_order' => $currentSortOrder]);

        AuditTrail::record(
            user: $request->user(),
            action: 'Office Reordered',
            auditable: $office,
            oldValues: ['sort_order' => $currentSortOrder],
            newValues: ['sort_order' => $target->sort_order],
            description: 'Moved office "'.$office->name.'" '.$validated['direction'].' in the approval chain',
        );

        return redirect()->route('offices.index')->with('success', 'Approval chain updated successfully.');
    }
}
