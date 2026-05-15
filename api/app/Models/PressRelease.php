<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PressRelease extends Model
{
    protected $fillable = [
        'profile_id', 'url', 'og_title', 'og_description', 'og_image', 'og_site_name', 'published_at', 'featured',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'featured'     => 'boolean',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'press_release_concerts');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'press_release_posts');
    }

    public function albums(): BelongsToMany
    {
        return $this->belongsToMany(Album::class, 'press_release_albums');
    }

    public function releases(): BelongsToMany
    {
        return $this->belongsToMany(Release::class, 'press_release_releases');
    }

    public function tours(): BelongsToMany
    {
        return $this->belongsToMany(Tour::class, 'press_release_tours');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'press_release_tags');
    }

    public function authors(): BelongsToMany
    {
        return $this->belongsToMany(Author::class, 'author_press_releases');
    }
}
