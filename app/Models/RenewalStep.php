<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RenewalStep extends Model
{
    protected $fillable = [
        'renewal_id',
        'office_id',
        'step_order',
        'status',
        'acted_by',
        'acted_at',
        'remarks',
    ];

    public function renewal(): BelongsTo
    {
        return $this->belongsTo(Renewal::class);
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'acted_at' => 'datetime',
        ];
    }
}
