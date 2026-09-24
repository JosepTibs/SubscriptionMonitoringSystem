<?php

namespace App\Http\Controllers;

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\Office;
use App\Services\AuditTrail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalFlowController extends Controller
{
    /**
     * Display all flows with their ordered steps.
     */
    public function index(): Response
    {
        $flows = ApprovalFlow::query()
            ->with('steps.office')
            ->orderBy('name')
            ->get();

        return Inertia::render('approval-flows/index', [
            'flows' => $flows,
        ]);
    }

    /**
     * Show the form for creating a new flow.
     */
    public function create(): Response
    {
        return Inertia::render('approval-flows/create', [
            'offices' => Office::ordered()->get(),
        ]);
    }

    /**
     * Store a newly created flow with its ordered steps.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->flowRules());

        $flow = ApprovalFlow::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_default' => false,
        ]);

        $this->syncSteps($flow, $validated['steps']);
        $flow->load('steps.office');

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Flow Created',
            auditable: $flow,
            newValues: ['steps' => $this->stepList($flow)],
            description: 'Created approval flow "'.$flow->name.'"',
        );

        return redirect()->route('approval-flows.index')->with('success', 'Approval flow created successfully.');
    }

    /**
     * Show the form for editing the specified flow.
     */
    public function edit(ApprovalFlow $approvalFlow): Response
    {
        $approvalFlow->load('steps.office');

        return Inertia::render('approval-flows/edit', [
            'approval_flow' => $approvalFlow,
            'offices' => Office::ordered()->get(),
        ]);
    }

    /**
     * Replace the flow's definition and steps. In-flight request snapshots
     * are independent, so replacing steps never affects them.
     */
    public function update(Request $request, ApprovalFlow $approvalFlow): RedirectResponse
    {
        $validated = $request->validate($this->flowRules($approvalFlow->id));

        $approvalFlow->load('steps.office');
        $oldValues = [
            'name' => $approvalFlow->name,
            'description' => $approvalFlow->description,
            'steps' => $this->stepList($approvalFlow),
        ];

        $approvalFlow->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        $this->syncSteps($approvalFlow, $validated['steps']);
        $approvalFlow->load('steps.office');

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Flow Updated',
            auditable: $approvalFlow,
            oldValues: $oldValues,
            newValues: [
                'name' => $approvalFlow->name,
                'description' => $approvalFlow->description,
                'steps' => $this->stepList($approvalFlow),
            ],
            description: 'Updated approval flow "'.$approvalFlow->name.'"',
        );

        return redirect()->route('approval-flows.index')->with('success', 'Approval flow updated successfully.');
    }

    /**
     * Flag the flow as the default; the model clears the previous default.
     */
    public function setDefault(Request $request, ApprovalFlow $approvalFlow): RedirectResponse
    {
        $previousDefault = ApprovalFlow::defaultFlow();

        $approvalFlow->update(['is_default' => true]);

        AuditTrail::record(
            user: $request->user(),
            action: 'Approval Flow Set as Default',
            auditable: $approvalFlow,
            oldValues: ['default_flow' => $previousDefault?->name],
            newValues: ['default_flow' => $approvalFlow->name],
            description: 'Set "'.$approvalFlow->name.'" as the default approval flow',
        );

        return redirect()->route('approval-flows.index')->with('success', '"'.$approvalFlow->name.'" is now the default approval flow.');
    }

    /**
     * Validation rules for a flow and its ordered office steps.
     *
     * @return array<string, mixed>
     */
    private function flowRules(?int $ignoreId = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('approval_flows', 'name')->ignore($ignoreId)],
            'description' => ['nullable', 'string'],
            'steps' => ['required', 'array', 'min:1'],
            'steps.*' => ['integer', 'exists:offices,id', 'distinct'],
        ];
    }

    /**
     * Replace the flow's steps with the given ordered office ids.
     *
     * @param  array<int, int>  $steps
     */
    private function syncSteps(ApprovalFlow $flow, array $steps): void
    {
        DB::transaction(function () use ($flow, $steps): void {
            $flow->steps()->delete();

            foreach (array_values($steps) as $index => $officeId) {
                $flow->steps()->create([
                    'office_id' => $officeId,
                    'step_order' => $index + 1,
                ]);
            }
        });
    }

    /**
     * Ordered office names describing the flow (for audit logs).
     *
     * @return array<int, string>
     */
    private function stepList(ApprovalFlow $flow): array
    {
        return $flow->steps->map(fn (ApprovalFlowStep $step): string => $step->office->name)->values()->all();
    }
}
