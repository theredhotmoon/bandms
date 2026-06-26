<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PresaleCode extends Model
{
    protected $fillable = [
        'code', 'concert_id', 'max_uses', 'used_count',
        'valid_from', 'valid_until', 'description',
    ];

    protected $casts = [
        'valid_from'  => 'datetime',
        'valid_until' => 'datetime',
    ];

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function tiers(): BelongsToMany
    {
        return $this->belongsToMany(
            ConcertTicketPriceTier::class,
            'presale_code_tiers',
            'presale_code_id',
            'concert_ticket_price_tier_id'
        );
    }
}
