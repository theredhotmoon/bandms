<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConcertTicketType extends Model
{
    protected $fillable = [
        'concert_id', 'name', 'description',
        'on_sale_until', 'max_per_order', 'sort_order',
    ];

    protected $casts = [
        'on_sale_until' => 'date',
    ];

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }
}
