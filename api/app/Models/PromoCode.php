<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromoCode extends Model
{
    protected $fillable = [
        'code', 'discount_type', 'value',
        'max_uses', 'used_count', 'expires_at', 'ticket_type_id',
    ];

    protected $casts = [
        'expires_at' => 'date',
    ];

    public function ticketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class, 'ticket_type_id');
    }
}
