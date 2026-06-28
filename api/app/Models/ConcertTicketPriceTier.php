<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConcertTicketPriceTier extends Model
{
    protected $fillable = [
        'concert_ticket_type_id', 'name', 'price', 'currency',
        'available_from', 'available_until', 'available_count', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price'           => 'decimal:2',
            'available_from'  => 'date:Y-m-d',
            'available_until' => 'date:Y-m-d',
            'available_count' => 'integer',
            'sort_order'      => 'integer',
        ];
    }

    public function ticketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class, 'concert_ticket_type_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public ?int $soldCountCache = null;

    public function soldCount(): int
    {
        return $this->soldCountCache ??= (int) $this->orderItems()
            ->whereHas('order', fn ($q) => $q->whereIn('status', ['paid', 'pending']))
            ->sum('quantity');
    }
}
