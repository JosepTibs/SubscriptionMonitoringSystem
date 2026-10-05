<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Hide-a-row archiving: `archived_at` keeps the record in the database
 * while the normal lists only show `notArchived()` rows.
 *
 * Delete stays a true hard delete — nothing here touches `delete()`.
 */
trait Archivable
{
    /**
     * Boot the trait: initialize the archived_at cast merge.
     */
    public function initializeArchivable(): void
    {
        $this->mergeCasts(['archived_at' => 'datetime']);
    }

    /**
     * Only rows that are not archived.
     *
     * @param  Builder<static>  $query
     */
    public function scopeNotArchived(Builder $query): void
    {
        $query->whereNull($this->qualifyColumn('archived_at'));
    }

    /**
     * Only rows that are archived.
     *
     * @param  Builder<static>  $query
     */
    public function scopeArchived(Builder $query): void
    {
        $query->whereNotNull($this->qualifyColumn('archived_at'));
    }

    /**
     * Hide the row from the normal lists.
     */
    public function archive(): bool
    {
        return $this->update(['archived_at' => now()]);
    }

    /**
     * Show the row in the normal lists again.
     */
    public function unarchive(): bool
    {
        return $this->update(['archived_at' => null]);
    }

    /**
     * Determine whether the row is currently archived.
     */
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }
}
