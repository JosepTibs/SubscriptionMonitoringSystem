<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    //

    protected $fillable =
        [
            'provider',
            'name',
            'cost',
            'billing_interval',
            'billing_interval_unit',
            'start_date',
            'renewal_date',
            'office_id',
            'owner_id',
            'status',
            'description',
        ];

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function renewals(): HasMany
    {
        return $this->hasMany(Renewal::class);
    }

    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'start_date' => 'date',
            'renewal_date' => 'date',
        ];
    }
}
