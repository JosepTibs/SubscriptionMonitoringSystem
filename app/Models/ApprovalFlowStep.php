<?php

namespace App\Models;

use App\Traits\LogsActivity;
use Database\Factories\ApprovalFlowStepFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalFlowStep extends Model
{
    /** @use HasFactory<ApprovalFlowStepFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = [
        'approval_flow_id',
        'office_id',
        'step_order',
    ];

    public function flow(): BelongsTo
    {
        return $this->belongsTo(ApprovalFlow::class, 'approval_flow_id');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    /**
     * Rich log label: flow name + step order + office.
     */
    protected function activityDisplayName(): string
    {
        $flow = $this->relationLoaded('flow')
            ? $this->getRelation('flow')
            : $this->flow()->first();

        $office = $this->relationLoaded('office')
            ? $this->getRelation('office')
            : $this->office()->first();

        $label = ($flow?->name ?? "Flow #{$this->approval_flow_id}")." · Step {$this->step_order}";

        if ($office?->name) {
            $label .= " @ {$office->name}";
        }

        return $label;
    }

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
        ];
    }
}
