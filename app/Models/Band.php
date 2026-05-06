<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Band extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'bio'];

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_band');
    }

    public function members(): HasMany
    {
        return $this->hasMany(BandMember::class);
    }

    public function releases(): HasMany
    {
        return $this->hasMany(Release::class);
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'band_id')->whereNull('member_id');
    }
}
