<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * An immutable copy of a rider, taken when it was sent out.
 *
 * `snapshot` holds what the resolver needs, not what it produced — see the
 * create_tech_rider_versions_table migration and App\Services\TechRiderSnapshotBuilder.
 */
class TechRiderVersion extends Model
{
    protected $fillable = [
        'tech_rider_id',
        'version_number',
        'notes',
        'snapshot',
        'status',
        'published_at',
    ];

    protected $casts = [
        'snapshot'     => 'array',
        'published_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $version) {
            if (empty($version->public_token)) {
                $version->public_token = Str::random(32);
            }
        });
    }

    public function techRider(): BelongsTo
    {
        return $this->belongsTo(TechRider::class);
    }
}
