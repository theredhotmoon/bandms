<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Release extends Model
{
    protected $fillable = ['profile_id', 'title', 'type', 'release_date', 'cover_image', 'description', 'is_upcoming', 'presave_url', 'label_name'];

    protected $casts = [
        'release_date' => 'date:Y-m-d',
        'is_upcoming'  => 'boolean',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(ReleaseTrack::class)->orderBy('sort_order')->orderBy('id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(ReleaseLink::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ReleasePhoto::class)->orderBy('sort_order')->orderBy('id');
    }
}
