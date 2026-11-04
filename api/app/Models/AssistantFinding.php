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
    /** `snoozed` is "Not now": back to `new` once `snoozed_until` passes (wakeSnoozed()). */
    public const STATUSES   = ['new', 'saved', 'dismissed', 'snoozed'];

    protected $fillable = [
        'kind', 'source', 'external_key', 'url', 'title', 'snippet', 'language', 'country',
        'lead_type', 'score', 'status', 'snoozed_until', 'woke_at', 'triage', 'saved_type', 'saved_id', 'payload', 'found_at', 'triaged_at',
    ];

    protected $attributes = ['status' => 'new', 'score' => 0, 'snippet' => ''];

    protected function casts(): array
    {
        return [
            'triage'     => 'array',
            'payload'    => 'array',
            'score'      => 'integer',
            'found_at'      => 'datetime',
            'triaged_at'    => 'datetime',
            'snoozed_until' => 'datetime',
            'woke_at'       => 'datetime',
        ];
    }

    /**
     * Snoozed findings whose date has passed go back to the inbox, stamped
     * `woke_at` so the next digest carries them too. Called by every reader
     * of `new` that a person sees (the inbox, the dashboard widget, the
     * digest) rather than by a scheduled job, so a missed run cannot leave
     * one asleep. `$at` is the moment to wake as of — the digest passes the
     * end of its window, so what it wakes falls inside that window.
     */
    public static function wakeSnoozed(?\DateTimeInterface $at = null): int
    {
        $at ??= now();

        return static::query()
            ->where('status', 'snoozed')
            ->where('snoozed_until', '<=', $at)
            ->update(['status' => 'new', 'snoozed_until' => null, 'woke_at' => $at]);
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
