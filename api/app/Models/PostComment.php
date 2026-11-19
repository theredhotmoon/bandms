<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A fan's comment under a news post. Plain text, published at once.
 *
 * Holds a non-user's personal data, so it is on ActivityRecorder::PERSONAL
 * and its table is prod-only in scripts/prodsync/tables.py.
 */
class PostComment extends Model
{
    protected $fillable = ['post_id', 'fan_account_id', 'body', 'hidden_at'];

    protected function casts(): array
    {
        return ['hidden_at' => 'datetime'];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function fan(): BelongsTo
    {
        return $this->belongsTo(FanAccount::class, 'fan_account_id');
    }

    /**
     * What anyone outside the admin may see: not hidden, and not written by a
     * fan who has since been blocked. The author gets no exception — a hidden
     * comment is gone for them too.
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereNull('hidden_at')
            ->whereHas('fan', fn (Builder $q) => $q->whereNull('comments_blocked_at'));
    }
}
