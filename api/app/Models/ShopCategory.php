<?php

namespace App\Models;

use App\Traits\HasSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ShopCategory extends Model
{
    use HasFactory, HasSlug;

    protected $fillable = ['profile_id', 'name', 'slug', 'description', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function items(): BelongsToMany
    {
        return $this->belongsToMany(ShopItem::class, 'shop_item_category');
    }
}
