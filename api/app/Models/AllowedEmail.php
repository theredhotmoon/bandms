<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AllowedEmail extends Model
{
    protected $fillable = [
        'email',
        'role',
        'band_member_id',
        'notes',
    ];

    public function bandMember(): BelongsTo
    {
        return $this->belongsTo(BandMember::class);
    }
}
