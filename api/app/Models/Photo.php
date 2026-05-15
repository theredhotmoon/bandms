<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Photo extends Model
{
    protected $fillable = ['album_id', 'image', 'sort_order', 'caption', 'epk_featured'];

    protected $casts = ['epk_featured' => 'boolean'];

    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'photo_post');
    }
}
