<?php

namespace App\Models\Concerns;

use App\Models\Album;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * A record that photo albums can be linked from (the admin's "Link to… →
 * Photo albums"). Adds `albums()` and detaches them when the record is
 * deleted — the pivot's owner side is polymorphic, so the database cannot
 * cascade it.
 */
trait HasAlbums
{
    public static function bootHasAlbums(): void
    {
        // A block, not an arrow fn — see HasClips: returning detach()'s count
        // would halt every later deleting listener.
        static::deleting(function ($model): void {
            $model->albums()->detach();
        });
    }

    public function albums(): MorphToMany
    {
        return $this->morphToMany(Album::class, 'albumable')
            ->withPivot('position')
            ->orderByPivot('position')
            ->orderBy('albums.id');
    }
}
