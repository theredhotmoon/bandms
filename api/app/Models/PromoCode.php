<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromoCode extends Model
{
    protected $fillable = [
        'code', 'discount_type', 'value', 'max_uses', 'used_count', 'expires_at', 'ticket_type_id',
    ];

    protected function casts(): array
    {
        return [
            'value'      => 'decimal:2',
            'expires_at' => 'date:Y-m-d',
            'max_uses'   => 'integer',
            'used_count' => 'integer',
        ];
    }

    public function ticketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class, 'ticket_type_id');
    }

    public function isValid(?int $ticketTypeId = null): bool
    {
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) return false;
        if ($this->ticket_type_id !== null && $this->ticket_type_id !== $ticketTypeId) return false;
        return true;
    }

    public function applyTo(float $amount): float
    {
        if ($this->discount_type === 'percent') {
            return max(0, $amount - ($amount * $this->value / 100));
        }
        return max(0, $amount - $this->value);
    }
}
