<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReleaseTrack extends Model
{
    protected $fillable = ['release_id', 'title', 'duration', 'lyrics', 'sort_order'];

    public function release(): BelongsTo
    {
        return $this->belongsTo(Release::class);
    }
}
