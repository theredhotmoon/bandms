<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One musician's answer to "is your rig right for this gig?" */
class TechRiderConfirmation extends Model
{
    protected $fillable = [
        'tech_rider_id',
        'band_member_id',
        'requested_at',
        'confirmed_at',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'confirmed_at' => 'datetime',
    ];

    public function techRider(): BelongsTo
    {
        return $this->belongsTo(TechRider::class);
    }

    public function bandMember(): BelongsTo
    {
        return $this->belongsTo(BandMember::class);
    }
}
