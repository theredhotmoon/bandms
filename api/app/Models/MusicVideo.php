<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MusicVideo extends Model
{
    protected $fillable = ['profile_id', 'title', 'video_url', 'published_at', 'sort_order', 'og_title', 'og_image', 'og_site_name', 'channel_name'];

    protected $casts = ['published_at' => 'date:Y-m-d'];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }
}
