<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BandMemberSetup extends Model
{
    protected $fillable = [
        'band_member_id',
        'instrument_id',
        'shared_monitor_id',
        'name',
        'is_default',
        'signal_chain_type',
        'inputs',
        'monitor',
        'backline',
        'power',
        'wireless',
        'foh_notes',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'inputs'     => 'array',
        'monitor'    => 'array',
        'backline'   => 'array',
        'power'      => 'array',
        'wireless'   => 'array',
    ];

    public function member(): BelongsTo
    {
        return $this->belongsTo(BandMember::class, 'band_member_id');
    }

    public function instrument(): BelongsTo
    {
        return $this->belongsTo(Instrument::class);
    }

    public function sharedMonitor(): BelongsTo
    {
        return $this->belongsTo(BandMemberSetup::class, 'shared_monitor_id');
    }
}
