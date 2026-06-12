<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\ShopItemVariant;

class ShopItem extends Model
{
    use HasFactory, HasSlug;

    protected $fillable = [
        'profile_id', 'name', 'slug', 'type', 'description',
        'is_available', 'is_presale', 'presale_ships_at',
        'stock_quantity', 'purchase_url', 'sort_order',
    ];

    protected $casts = [
        'is_available'    => 'boolean',
        'is_presale'      => 'boolean',
        'presale_ships_at'=> 'date:Y-m-d',
        'stock_quantity'  => 'integer',
        'sort_order'      => 'integer',
    ];

    public function prices(): HasMany
    {
        return $this->hasMany(ShopItemPrice::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ShopItemPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'shop_item_tag');
    }

    public function releases(): BelongsToMany
    {
        return $this->belongsToMany(Release::class, 'shop_item_release');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'shop_item_concert');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'shop_item_post');
    }

    public function videos(): BelongsToMany
    {
        return $this->belongsToMany(MusicVideo::class, 'shop_item_video');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(ShopCategory::class, 'shop_item_category');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ShopItemVariant::class)->orderBy('sort_order');
    }
}
