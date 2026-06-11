<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopItemPrice extends Model
{
    public $timestamps = false;

    protected $fillable = ['shop_item_id', 'currency', 'amount'];

    protected $casts = ['amount' => 'decimal:2'];

    public function shopItem(): BelongsTo
    {
        return $this->belongsTo(ShopItem::class);
    }
}
