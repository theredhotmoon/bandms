<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BandMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'band_id',
        'first_name',
        'last_name',
        'bio',
        'photo',
        'role',
        'is_current',
        'joined_at',
        'quit_at',
        'sort_order',
    ];

    protected $casts = [
        'is_current' => 'boolean',
        'joined_at'  => 'date:Y-m-d',
        'quit_at'    => 'date:Y-m-d',
        'sort_order' => 'integer',
    ];

    public function band(): BelongsTo
    {
        return $this->belongsTo(Band::class);
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'member_id');
    }
}
