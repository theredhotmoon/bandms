<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialLink extends Model
{
    protected $fillable = ['band_id', 'member_id', 'platform', 'url'];

    public function band(): BelongsTo
    {
        return $this->belongsTo(Band::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(BandMember::class, 'member_id');
    }
}
