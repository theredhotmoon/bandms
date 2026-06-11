<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopItemPhoto extends Model
{
    protected $fillable = ['shop_item_id', 'image', 'sort_order', 'alt_text'];

    protected $casts = ['sort_order' => 'integer'];

    public function shopItem(): BelongsTo
    {
        return $this->belongsTo(ShopItem::class);
    }
}
