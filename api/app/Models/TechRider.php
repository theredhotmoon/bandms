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
        'placements',
        'extra_inputs',
        'extra_monitors',
        'extra_backline',
        'extra_wireless',
        'channel_order',
        'power_notes',
        'pa_foh',
    ];

    protected $casts = [
        'is_active'      => 'boolean',
        'gig_lineup'     => 'array',
        'placements'     => 'array',
        'extra_inputs'   => 'array',
        'extra_monitors' => 'array',
        'extra_backline' => 'array',
        'extra_wireless' => 'array',
        'channel_order'  => 'array',
        'power_notes'    => 'array',
        'pa_foh'         => 'array',
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

    /**
     * The band_member_setups rows this rider's placements point at.
     *
     * Sent alongside the rider so every consumer — admin editor, preview, and
     * the public token view — resolves placements with the same data and the
     * same code, instead of the API resolving for some callers and not others.
     *
     * @return \Illuminate\Support\Collection<int, BandMemberSetup>
     */
    public function referencedSetups()
    {
        $ids = collect($this->placements ?? [])
            ->pluck('setup_id')
            ->filter(fn ($id) => is_int($id) || ctype_digit((string) $id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return BandMemberSetup::whereIn('id', $ids)->get();
    }
}
