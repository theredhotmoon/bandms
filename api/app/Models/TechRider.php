<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TechRider extends Model
{
    protected $fillable = [
        'profile_id',
        'name',
        'is_active',
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

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }
}
