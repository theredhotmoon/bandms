<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\MusicVideo;
use App\Models\PressRelease;
use Spatie\Translatable\HasTranslations;

class Post extends Model
{
    use HasFactory, HasSlug, HasTranslations;

    public array $translatable = ['title', 'intro', 'content'];

    protected $fillable = ['title', 'slug_en', 'slug_pl', 'intro', 'content', 'image', 'published_at', 'event_date'];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'event_date'   => 'date',
        ];
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'post_tag');
    }

    public function links(): HasMany
    {
        return $this->hasMany(PostLink::class)->orderBy('sort_order')->orderBy('id');
    }

    public function photos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'photo_post');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'post_concerts');
    }

    public function albums(): BelongsToMany
    {
        return $this->belongsToMany(Album::class, 'post_albums');
    }

    public function releases(): BelongsToMany
    {
        return $this->belongsToMany(Release::class, 'post_releases');
    }

    public function tours(): BelongsToMany
    {
        return $this->belongsToMany(Tour::class, 'post_tours');
    }

    public function musicVideos(): BelongsToMany
    {
        return $this->belongsToMany(MusicVideo::class, 'post_music_videos');
    }

    public function pressReleases(): BelongsToMany
    {
        return $this->belongsToMany(PressRelease::class, 'press_release_posts');
    }
}
