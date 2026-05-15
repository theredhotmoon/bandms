<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConcertLink extends Model
{
    protected $fillable = ['concert_id', 'label', 'url'];

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }
}
