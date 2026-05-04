<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Photo extends Model
{
    use HasFactory, HasSlug;

    protected $fillable = ['title', 'slug', 'description', 'image', 'venue_id', 'concert_id', 'taken_at', 'published_at'];

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
        return $this->belongsToMany(Tag::class, 'photo_tag');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'photo_post');
    }
}
