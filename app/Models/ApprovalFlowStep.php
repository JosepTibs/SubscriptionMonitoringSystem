<?php

namespace App\Models;

use Database\Factories\ApprovalFlowStepFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalFlowStep extends Model
{
    /** @use HasFactory<ApprovalFlowStepFactory> */
    use HasFactory;

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

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
        ];
    }
}
