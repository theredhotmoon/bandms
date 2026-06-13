<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopItemVariant extends Model
{
    use HasFactory;

    protected $fillable = ['shop_item_id', 'name', 'value', 'stock_quantity', 'sort_order'];

    protected $casts = [
        'stock_quantity' => 'integer',
        'sort_order'     => 'integer',
    ];

    public function shopItem(): BelongsTo
    {
        return $this->belongsTo(ShopItem::class);
    }
}
