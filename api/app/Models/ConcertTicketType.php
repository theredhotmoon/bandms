<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConcertTicketType extends Model
{
    protected $fillable = [
        'concert_id', 'name', 'description', 'available_from', 'on_sale_until', 'max_per_order', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'available_from' => 'datetime',
            'on_sale_until'  => 'datetime',
            'max_per_order'  => 'integer',
            'sort_order'     => 'integer',
        ];
    }

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function tiers(): HasMany
    {
        return $this->hasMany(ConcertTicketPriceTier::class)->orderBy('sort_order');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function soldCount(): int
    {
        return $this->orderItems()
            ->whereHas('order', fn ($q) => $q->whereIn('status', ['paid', 'pending']))
            ->sum('quantity');
    }

    public function activeTier(): ?ConcertTicketPriceTier
    {
        $today = now()->toDateString();

        return $this->tiers
            ->filter(function (ConcertTicketPriceTier $tier) use ($today) {
                if ($tier->available_from && $tier->available_from->toDateString() > $today) return false;
                if ($tier->available_until && $tier->available_until->toDateString() < $today) return false;
                if ($tier->available_count !== null) {
                    if ($tier->soldCount() >= $tier->available_count) return false;
                }
                return true;
            })
            ->sortBy('sort_order')
            ->first();
    }

    public function isOnSale(): bool
    {
        // Not started yet
        if ($this->available_from && $this->available_from->isFuture()) return false;

        // Sale window closed explicitly
        if ($this->on_sale_until && $this->on_sale_until->isPast()) return false;

        // If no explicit cutoff, use concert date as implicit deadline
        if (! $this->on_sale_until) {
            $concertDate = $this->concert?->date;
            if ($concertDate && $concertDate->endOfDay()->isPast()) return false;
        }

        return $this->activeTier() !== null;
    }
}
