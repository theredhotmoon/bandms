<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A site, channel or account the band marked as wrong: the crawler adds
 * nothing new from it (`CrawlSourceJob::upsert`). `site_key` is
 * `SiteKey::for()`'s key; `label` is what the inbox shows.
 */
class AssistantBlockedSite extends Model
{
    protected $fillable = ['site_key', 'label', 'created_by'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return list<string> */
    public static function keys(): array
    {
        return static::query()->pluck('site_key')->all();
    }
}
