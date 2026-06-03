<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BandMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'first_name',
        'nickname',
        'last_name',
        'bio',
        'photo',
        'role',
        'is_current',
        'joined_at',
        'quit_at',
        'sort_order',
        'calendar_url',
        'login_email',
        'can_login',
        'default_gear',
        'main_instrument_id',
    ];

    protected $casts = [
        'is_current'   => 'boolean',
        'can_login'    => 'boolean',
        'joined_at'    => 'date:Y-m-d',
        'quit_at'      => 'date:Y-m-d',
        'sort_order'   => 'integer',
        'default_gear' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'member_id');
    }

    public function mainInstrument(): BelongsTo
    {
        return $this->belongsTo(Instrument::class, 'main_instrument_id');
    }

    public function instruments(): BelongsToMany
    {
        return $this->belongsToMany(Instrument::class);
    }

    public function setups(): HasMany
    {
        return $this->hasMany(BandMemberSetup::class);
    }
}
