<?php

namespace App\Models;

use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Renewal extends Model
{
    use LogsActivity;

    protected $fillable = [
        'subscription_id',
        'previous_renewal_date',
        'new_renewal_date',
        'previous_cost',
        'new_cost',
        'decision',
        'reviewed_by',
        'reviewed_at',
        'remarks',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Rich log label: the subscription plus the renewal decision/date.
     */
    protected function activityDisplayName(): string
    {
        $subscription = $this->relationLoaded('subscription')
            ? $this->getRelation('subscription')
            : $this->subscription()->first();

        $name = $subscription?->name ?? "Renewal #{$this->getKey()}";
        $detail = $this->new_renewal_date?->toDateString() ?? $this->decision ?? '';

        return $detail !== '' ? "'{$name}' → {$detail}" : "'{$name}'";
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

        return array_filter([
            'subscription_id' => $this->subscription_id,
            'subscription_name' => $subscription?->name,
            'decision' => $this->decision,
            'previous_renewal_date' => $this->previous_renewal_date?->toDateString(),
            'new_renewal_date' => $this->new_renewal_date?->toDateString(),
            'previous_cost' => $this->previous_cost,
            'new_cost' => $this->new_cost,
        ], fn ($value) => $value !== null);
    }

    protected function casts(): array
    {
        return [
            'previous_renewal_date' => 'date',
            'new_renewal_date' => 'date',
            'previous_cost' => 'decimal:2',
            'new_cost' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }
}
