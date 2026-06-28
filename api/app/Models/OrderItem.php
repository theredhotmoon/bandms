<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id', 'shop_item_id', 'shop_item_variant_id',
        'concert_ticket_type_id', 'concert_ticket_price_tier_id',
        'name', 'variant_label', 'price', 'currency', 'quantity',
        'ticket_code', 'scanned_at',
    ];

    protected $casts = [
        'price'      => 'decimal:2',
        'quantity'   => 'integer',
        'scanned_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function shopItem(): BelongsTo
    {
        return $this->belongsTo(ShopItem::class);
    }

    public function shopItemVariant(): BelongsTo
    {
        return $this->belongsTo(ShopItemVariant::class);
    }

    public function concertTicketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class);
    }

    public function concertTicketPriceTier(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketPriceTier::class);
    }
}
