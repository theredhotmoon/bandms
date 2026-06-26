<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    protected $fillable = [
        'uuid', 'order_item_id', 'concert_ticket_type_id',
        'status', 'holder_email', 'holder_name',
        'fan_account_id', 'wallet_pass_serial',
        'scanned_at', 'transferred_at', 'transferred_from_id',
    ];

    protected $casts = [
        'scanned_at'     => 'datetime',
        'transferred_at' => 'datetime',
    ];

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function concertTicketType(): BelongsTo
    {
        return $this->belongsTo(ConcertTicketType::class);
    }

    public function fanAccount(): BelongsTo
    {
        return $this->belongsTo(FanAccount::class);
    }

    public function transferredFrom(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'transferred_from_id');
    }
}
