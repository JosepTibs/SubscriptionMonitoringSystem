<?php

namespace App\Models;

use App\Traits\LogsActivity;
use Database\Factories\OwnerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Owner extends Model
{
    /** @use HasFactory<OwnerFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
    ];

    /**
     * Subscriptions this department owns.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
