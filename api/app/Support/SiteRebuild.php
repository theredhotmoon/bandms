<?php

namespace App\Support;

use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Http;

/**
 * Asks the `web` container to rebuild the static public site, and tracks
 * which content areas have unrebuilt changes.
 *
 * Extracted from WebsiteModuleController, which owned the only copy — so every
 * *other* thing the public site bakes had to remember to call a private method
 * on an unrelated controller, and hero images did not. Anything that changes
 * baked content belongs here rather than growing a second copy.
 */
final class SiteRebuild
{
    /**
     * Call this after any write whose result the public site bakes. Always
     * records the area as dirty. If the band has asked for automatic
     * rebuilds, also fires the rebuild and clears the pending list — with
     * auto-rebuild on, the admin hides its manual button, so a save has to
     * reach the public site some other way.
     */
    public static function markDirty(string $area): void
    {
        SiteDirtyArea::markDirty($area);

        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            self::request();
            self::clearPending();
        }
    }

    /** Fire-and-forget: the webhook is absent in tests and may be down in dev. */
    public static function request(): void
    {
        try {
            Http::timeout(5)->post('http://web:3001/rebuild');
        } catch (\Exception) {
            // Deliberately swallowed — a rebuild that cannot be reached must not
            // fail the write that triggered it.
        }
    }

    /**
     * Pending state clears the moment a rebuild is triggered, not when it
     * finishes — matching request()'s own fire-and-forget philosophy.
     */
    public static function clearPending(): void
    {
        SiteDirtyArea::clearAll();
    }

    public static function pendingAreas(): array
    {
        return SiteDirtyArea::pending();
    }
}
