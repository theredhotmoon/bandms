<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Setlist extends Model
{
    protected $fillable = [
        'concert_id',
        'name',
        'event_date',
        'venue',
        'setlistfm_id',
        'foh_notes',
        'lighting_notes',
    ];

    protected $casts = [
        'event_date' => 'date',
        'concert_id' => 'integer',
    ];

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SetlistItem::class)->orderBy('position');
    }
}
