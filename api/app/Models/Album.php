<?php

namespace App\Models;

use App\Models\Concerns\HasClips;
use App\Traits\HasTranslatedSlug;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class Album extends Model
{
    use HasTranslatedSlug, HasTranslations, HasClips;

    /** Only the slug: an album's title is a plain string. */
    public array $translatable = ['slug'];

    protected $fillable = ['title', 'slug', 'description', 'venue_id', 'concert_id', 'taken_at', 'published_at'];

    protected function casts(): array
    {
        return [
            'taken_at'     => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'album_tag');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class)->orderBy('sort_order');
    }
}
