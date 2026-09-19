<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Renewal extends Model
{
    //
    protected $fillable = [
        'subscription_id',
        'current_office_id',
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

    public function currentOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'current_office_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(RenewalStep::class)->orderBy('step_order');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
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
