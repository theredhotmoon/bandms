<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReleaseTrack extends Model
{
    protected $fillable = [
        'release_id', 'title', 'duration', 'lyrics', 'sort_order',
        'bpm', 'musical_key', 'mood_tags', 'isrc', 'explicit', 'stems_available', 'sync_placements',
    ];

    protected $casts = [
        'explicit'       => 'boolean',
        'stems_available'=> 'boolean',
    ];

    public function release(): BelongsTo
    {
        return $this->belongsTo(Release::class);
    }

    public function links(): HasMany
    {
        return $this->hasMany(ReleaseTrackLink::class, 'track_id');
    }
}
