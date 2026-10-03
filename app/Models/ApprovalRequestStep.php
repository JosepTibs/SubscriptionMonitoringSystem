<?php

namespace App\Models;

use App\Traits\LogsActivity;
use Database\Factories\ApprovalRequestStepFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalRequestStep extends Model
{
    /** @use HasFactory<ApprovalRequestStepFactory> */
    use HasFactory, LogsActivity;

    public const STATUS_PENDING = 'pending';

    public const STATUS_RECEIVED = 'received';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_FORWARDED = 'forwarded';

    public const STATUS_RETURNED = 'returned';

    protected $fillable = [
        'approval_request_id',
        'office_id',
        'step_order',
        'status',
        'acted_by',
        'approved_by_name',
        'acted_at',
        'received_by_name',
        'received_at',
        'forwarded_by_name',
        'forwarded_at',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }

    /**
     * Rich log label: subscription + step + office, e.g.
     * "'Netflix' · Step 2 @ Budget". Falls back to ids when relations
     * are unavailable (factory writes, deleted offices).
     */
    protected function activityDisplayName(): string
    {
        $request = $this->relationLoaded('approvalRequest')
            ? $this->getRelation('approvalRequest')
            : $this->approvalRequest()->first();

        $subscriptionName = $request !== null
            ? ($request->relationLoaded('subscription')
                ? $request->getRelation('subscription')?->name
                : $request->subscription()->first()?->name)
            : null;

        $office = $this->relationLoaded('office')
            ? $this->getRelation('office')
            : $this->office()->first();

        $label = "'".($subscriptionName ?? "Request #{$this->approval_request_id}")."'";
        $label .= " · Step {$this->step_order}";

        if ($office?->name) {
            $label .= " @ {$office->name}";
        }

        return $label;
    }

    /**
     * Option A suffix: the typed signatory names recorded on this step —
     * the account-less people from the scope rule, not the ICT encoder.
     */
    protected function activitySuffix(): string
    {
        $names = array_filter([
            $this->received_by_name !== null && $this->received_by_name !== '' ? "received by '{$this->received_by_name}'" : null,
            $this->approved_by_name !== null && $this->approved_by_name !== '' ? "approved by '{$this->approved_by_name}'" : null,
            $this->forwarded_by_name !== null && $this->forwarded_by_name !== '' ? "sent by '{$this->forwarded_by_name}'" : null,
        ]);

        return $names === [] ? '' : ' — '.implode(', ', $names);
    }

    /**
     * Structured snapshot stored under properties.context, mirroring the
     * trail-correction snapshot shape.
     *
     * @return array<string, mixed>
     */
    protected function activityContext(): array
    {
        $request = $this->relationLoaded('approvalRequest')
            ? $this->getRelation('approvalRequest')
            : $this->approvalRequest()->first();

        $subscriptionName = $request !== null
            ? ($request->relationLoaded('subscription')
                ? $request->getRelation('subscription')?->name
                : $request->subscription()->first()?->name)
            : null;

        $office = $this->relationLoaded('office')
            ? $this->getRelation('office')
            : $this->office()->first();

        return array_filter([
            'subscription_id' => $request?->subscription_id,
            'subscription_name' => $subscriptionName,
            'approval_request_id' => $this->approval_request_id,
            'step_order' => $this->step_order,
            'office' => $office?->name,
            'status' => $this->status,
            'received_by' => $this->received_by_name,
            'received_at' => $this->received_at?->toDateTimeString(),
            'approved_by' => $this->approved_by_name,
            'acted_at' => $this->acted_at?->toDateTimeString(),
            'sent_by' => $this->forwarded_by_name,
            'forwarded_at' => $this->forwarded_at?->toDateTimeString(),
        ], fn ($value) => $value !== null);
    }

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'acted_at' => 'datetime',
            'received_at' => 'datetime',
            'forwarded_at' => 'datetime',
        ];
    }
}
