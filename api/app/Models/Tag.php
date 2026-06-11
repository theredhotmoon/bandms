<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    use HasFactory, HasSlug;

    protected $fillable = ['name', 'slug'];

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'post_tag');
    }

    public function photos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'photo_tag');
    }

    public function bands(): BelongsToMany
    {
        return $this->belongsToMany(Band::class, 'band_tag');
    }

    public function venues(): BelongsToMany
    {
        return $this->belongsToMany(Venue::class, 'venue_tag');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_tag');
    }

    public function shopItems(): BelongsToMany
    {
        return $this->belongsToMany(ShopItem::class, 'shop_item_tag');
    }
}
