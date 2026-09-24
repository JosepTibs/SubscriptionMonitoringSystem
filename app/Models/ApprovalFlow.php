<?php

namespace App\Models;

use Database\Factories\ApprovalFlowFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalFlow extends Model
{
    /** @use HasFactory<ApprovalFlowFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_default',
    ];

    protected static function booted(): void
    {
        // Exactly one default flow: unset all others when one is saved as default.
        static::saved(function (ApprovalFlow $flow): void {
            if ($flow->is_default) {
                static::withoutTimestamps(fn () => static::query()
                    ->where('id', '!=', $flow->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false]));
            }
        });
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalFlowStep::class)->orderBy('step_order');
    }

    public static function defaultFlow(): ?self
    {
        return static::query()->where('is_default', true)->first();
    }

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }
}
