<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketTransfer extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'from_ticket_id',
        'to_email',
        'claim_token',
        'expires_at',
        'claimed_at',
    ];

    protected $casts = [
        'expires_at'  => 'datetime',
        'claimed_at'  => 'datetime',
        'created_at'  => 'datetime',
    ];

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    public function fromTicket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'from_ticket_id');
    }
}
