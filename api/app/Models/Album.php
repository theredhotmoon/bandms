<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Album extends Model
{
    use HasSlug;

    protected $fillable = ['title', 'slug_en', 'slug_pl', 'description', 'venue_id', 'concert_id', 'taken_at', 'published_at'];

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
