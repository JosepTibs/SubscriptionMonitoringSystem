<?php

namespace App\Models;

use App\Traits\LogsActivity;
use Database\Factories\ApprovalRequestFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalRequest extends Model
{
    /** @use HasFactory<ApprovalRequestFactory> */
    use HasFactory, LogsActivity;

    public const TYPE_PROCUREMENT = 'procurement';

    public const TYPE_RENEWAL = 'renewal';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_RETURNED = 'returned';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'subscription_id',
        'type',
        'renewal_id',
        'approval_flow_id',
        'current_office_id',
        'status',
        'decided_by',
        'decided_at',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function renewal(): BelongsTo
    {
        return $this->belongsTo(Renewal::class);
    }

    public function flow(): BelongsTo
    {
        return $this->belongsTo(ApprovalFlow::class, 'approval_flow_id');
    }

    public function currentOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'current_office_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalRequestStep::class)->orderBy('step_order');
    }

    /**
     * Rich log label: the subscription this chain belongs to, e.g.
     * "'Netflix' (procurement #12)". Falls back to the id when the
     * subscription row is gone (cascade deletes the request anyway).
     */
    protected function activityDisplayName(): string
    {
        $subscription = $this->relationLoaded('subscription')
            ? $this->getRelation('subscription')
            : $this->subscription()->first();

        $name = $subscription?->name ?? "Request #{$this->getKey()}";

        return "'{$name}' ({$this->type} #{$this->getKey()})";
    }

    /**
     * Option A suffix: current location + status of the chain.
     */
    protected function activitySuffix(): string
    {
        $office = $this->relationLoaded('currentOffice')
            ? $this->getRelation('currentOffice')
            : $this->currentOffice()->first();

        $parts = [];

        if ($office?->name) {
            $parts[] = "at {$office->name}";
        }

        if ($this->getAttribute('status')) {
            $parts[] = "status: {$this->status}";
        }

        return $parts === [] ? '' : ' — '.implode(', ', $parts);
    }

    /**
     * Structured context stored under properties.context.
     *
     * @return array<string, mixed>
     */
    protected function activityContext(): array
    {
        $subscription = $this->relationLoaded('subscription')
            ? $this->getRelation('subscription')
            : $this->subscription()->first();

        $office = $this->relationLoaded('currentOffice')
            ? $this->getRelation('currentOffice')
            : $this->currentOffice()->first();

        return array_filter([
            'subscription_id' => $this->subscription_id,
            'subscription_name' => $subscription?->name,
            'type' => $this->type,
            'status' => $this->status,
            'current_office' => $office?->name,
        ], fn ($value) => $value !== null);
    }

    /**
     * In-progress requests currently sitting at the given office.
     *
     * @param  Builder<self>  $query
     */
    public function scopeAtOffice(Builder $query, int $officeId): void
    {
        $query->where('status', self::STATUS_IN_PROGRESS)
            ->where('current_office_id', $officeId);
    }

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }
}
