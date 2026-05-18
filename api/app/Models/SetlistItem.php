<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SetlistItem extends Model
{
    protected $fillable = [
        'setlist_id',
        'song_id',
        'position',
        'is_encore',
        'transition',
        'lighting_cue',
        'sound_note',
        'member_notes',
        'override_duration_sec',
    ];

    protected $casts = [
        'position'              => 'integer',
        'is_encore'             => 'boolean',
        'member_notes'          => 'array',
        'override_duration_sec' => 'integer',
    ];

    public function setlist(): BelongsTo
    {
        return $this->belongsTo(Setlist::class);
    }

    public function song(): BelongsTo
    {
        return $this->belongsTo(Song::class);
    }
}
