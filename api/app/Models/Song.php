<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Song extends Model
{
    protected $fillable = [
        'title',
        'duration_sec',
        'bpm',
        'key',
        'notes',
    ];

    protected $casts = [
        'duration_sec' => 'integer',
        'bpm'          => 'integer',
    ];

    public function setlistItems(): HasMany
    {
        return $this->hasMany(SetlistItem::class);
    }
}
