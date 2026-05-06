<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Release extends Model
{
    protected $fillable = ['band_id', 'title', 'type', 'release_date', 'cover_image', 'description'];

    protected $casts = [
        'release_date' => 'date:Y-m-d',
    ];

    public function band(): BelongsTo
    {
        return $this->belongsTo(Band::class);
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(ReleaseTrack::class)->orderBy('sort_order')->orderBy('id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(ReleaseLink::class);
    }
}
