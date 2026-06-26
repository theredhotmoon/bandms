<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ConcertTicketPriceTier extends Model
{
    protected $fillable = [
        'concert_ticket_type_id', 'name', 'price', 'currency',
        'available_from', 'available_until', 'available_count', 'sort_order',
    ];

    protected $casts = [
        'available_from'  => 'date',
        'available_until' => 'date',
        'price'           => 'decimal:2',
    ];

    public function concertTicketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class);
    }

    public function presaleCodes(): BelongsToMany
    {
        return $this->belongsToMany(
            PresaleCode::class,
            'presale_code_tiers',
            'concert_ticket_price_tier_id',
            'presale_code_id'
        );
    }
}
