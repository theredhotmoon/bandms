<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TourLink extends Model
{
    protected $fillable = ['tour_id', 'label', 'url'];

    public function tour(): BelongsTo
    {
        return $this->belongsTo(Tour::class);
    }
}
