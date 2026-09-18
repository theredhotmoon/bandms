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
        static::deleting(fn ($model) => $model->clips()->detach());
    }

    public function clips(): MorphToMany
    {
        return $this->morphToMany(Clip::class, 'clippable')
            ->withPivot('position')
            ->orderByPivot('position')
            ->orderBy('clips.id');
    }
}
