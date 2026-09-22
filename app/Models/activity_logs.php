<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class activity_logs extends Model
{
    //
    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'subject_id',
        'subject_type',
        'event',
        'description',
        'ip_address',
        'user_agent',
        'properties',
        'created_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'properties' => 'array',
    ];

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * Get the user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the subject model that was acted upon (polymorphic).
     */
    public function subject()
    {

        return $this->MorphTo();
    }
}
