<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MusicVideo extends Model
{
    protected $fillable = ['profile_id', 'title', 'video_url', 'published_at', 'sort_order', 'og_title', 'og_image', 'og_site_name', 'channel_name', 'view_count', 'views_synced_at'];

    protected $casts = [
        'published_at'   => 'date:Y-m-d',
        'view_count'     => 'integer',
        'views_synced_at'=> 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'post_music_videos');
    }
}
