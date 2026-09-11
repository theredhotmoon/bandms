<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\PressRelease;
use Spatie\Translatable\HasTranslations;

class Post extends Model
{
    use HasFactory, HasSlug, HasTranslations;

    public array $translatable = ['title', 'intro'];

    protected $fillable = ['title', 'slug_en', 'slug_pl', 'intro', 'image', 'published_at', 'event_date_display'];

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

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'post_concerts');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(PostBlock::class)->orderBy('position')->orderBy('id');
    }

    public function photos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'photo_post');
    }

    public function pressReleases(): BelongsToMany
    {
        return $this->belongsToMany(PressRelease::class, 'press_release_posts');
    }
}
