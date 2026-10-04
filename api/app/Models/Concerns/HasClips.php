<?php

namespace App\Models\Concerns;

use App\Models\Clip;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * An owner of clips. Adds `clips()` and detaches them when the owner is
 * deleted — the pivot's owner side is polymorphic, so the database cannot
 * cascade it.
 */
trait HasClips
{
    public static function bootHasClips(): void
    {
        // A block, not an arrow fn: `deleting` is a halting event, and an arrow
        // fn returns detach()'s row count — a non-null result that stops every
        // deleting listener registered after this one (HasMembers' included).
        static::deleting(function ($model): void {
            $model->clips()->detach();
        });
    }

    public function clips(): MorphToMany
    {
        return $this->morphToMany(Clip::class, 'clippable')
            ->withPivot('position')
            ->orderByPivot('position')
            ->orderBy('clips.id');
    }
}
