<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BandMemberSetup extends Model
{
    protected $fillable = [
        'band_member_id',
        'instrument_id',
        'name',
        'signal_chain_type',
        'inputs',
        'monitor',
        'backline',
        'power',
        'wireless',
        'foh_notes',
    ];

    protected $casts = [
        'inputs'   => 'array',
        'monitor'  => 'array',
        'backline' => 'array',
        'power'    => 'array',
        'wireless' => 'array',
    ];

    public function member(): BelongsTo
    {
        return $this->belongsTo(BandMember::class, 'band_member_id');
    }

    public function instrument(): BelongsTo
    {
        return $this->belongsTo(Instrument::class);
    }
}
