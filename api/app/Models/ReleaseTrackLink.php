<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReleaseTrackLink extends Model
{
    protected $fillable = ['track_id', 'platform', 'url'];

    public function track(): BelongsTo
    {
        return $this->belongsTo(ReleaseTrack::class, 'track_id');
    }
}
