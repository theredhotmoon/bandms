<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BandLogo extends Model
{
    protected $fillable = [
        'profile_id',
        'file_path',
        'original_name',
        'mime_type',
        'file_size',
        'width',
        'height',
        'label',
        'variant',
        'background',
        'is_default',
        'is_deprecated',
        'version_label',
        'notes',
        'sort_order',
    ];

    protected $casts = [
        'is_default'    => 'boolean',
        'is_deprecated' => 'boolean',
        'file_size'     => 'integer',
        'width'         => 'integer',
        'height'        => 'integer',
        'sort_order'    => 'integer',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    /** Convenience: full public URL for the stored file. */
    public function getUrlAttribute(): string
    {
        return '/storage/' . $this->file_path;
    }

    /** True when the file is an SVG (no pixel dimensions). */
    public function getIsVectorAttribute(): bool
    {
        return $this->mime_type === 'image/svg+xml';
    }
}
