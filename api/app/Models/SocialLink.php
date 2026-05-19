<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialLink extends Model
{
    use HasFactory;

    protected $fillable = ['profile_id', 'member_id', 'platform', 'url'];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(BandMember::class, 'member_id');
    }
}
