<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    use HasFactory, HasSlug;

    protected $fillable = ['title', 'slug', 'intro', 'content', 'image', 'published_at'];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
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
}
