<?php

namespace App\Models\Concerns;

use App\Models\BandMember;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * Content that band members can be linked to. Adds `members()` and detaches
 * them when the content is deleted — the pivot's content side is polymorphic,
 * so the database cannot cascade it.
 */
trait HasMembers
{
    public static function bootHasMembers(): void
    {
        // A block, not an arrow fn — see HasClips: returning detach()'s count
        // would halt every later deleting listener.
        static::deleting(function ($model): void {
            $model->members()->detach();
        });
    }

    public function members(): MorphToMany
    {
        return $this->morphToMany(BandMember::class, 'memberable')
            ->orderBy('band_members.sort_order')
            ->orderBy('band_members.id');
    }
}
