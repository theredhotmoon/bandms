<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One thing the crawler found: a mention of the band, a piece of ska news, or
 * a lead (a venue, promoter, festival, band, outlet or profile to reach).
 * Holds a pointer and a short snippet — never the page itself.
 */
class AssistantFinding extends Model
{
    use HasFactory;

    public const KINDS      = ['mention', 'news', 'lead'];
    public const LEAD_TYPES = ['venue', 'promoter', 'festival', 'band', 'media', 'profile'];
    public const STATUSES   = ['new', 'saved', 'dismissed'];

    protected $fillable = [
        'kind', 'source', 'external_key', 'url', 'title', 'snippet', 'language', 'country',
        'lead_type', 'score', 'status', 'triage', 'saved_type', 'saved_id', 'payload', 'found_at', 'triaged_at',
    ];

    protected $attributes = ['status' => 'new', 'score' => 0, 'snippet' => ''];

    protected function casts(): array
    {
        return [
            'triage'     => 'array',
            'payload'    => 'array',
            'score'      => 'integer',
            'found_at'   => 'datetime',
            'triaged_at' => 'datetime',
        ];
    }

    public function scopeKind(Builder $q, string $kind): Builder
    {
        return $q->where('kind', $kind);
    }

    public function scopeCountry(Builder $q, string $country): Builder
    {
        return $q->where('country', strtoupper($country));
    }

    public function scopeStatus(Builder $q, string $status): Builder
    {
        return $q->where('status', $status);
    }
}
