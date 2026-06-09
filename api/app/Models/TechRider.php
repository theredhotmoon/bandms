<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class TechRider extends Model
{
    protected $fillable = [
        'profile_id',
        'name',
        'is_active',
        'public_token',
        'concert_id',
        'gig_lineup',
        'stage_plot_data',
        'inputs',
        'monitors',
        'backline',
        'pa_foh',
        'power',
        'rf_wireless',
    ];

    protected $casts = [
        'is_active'       => 'boolean',
        'gig_lineup'      => 'array',
        'stage_plot_data' => 'array',
        'inputs'          => 'array',
        'monitors'        => 'array',
        'backline'        => 'array',
        'pa_foh'          => 'array',
        'power'           => 'array',
        'rf_wireless'     => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $rider) {
            if (empty($rider->public_token)) {
                $rider->public_token = Str::random(32);
            }
        });
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }
}
