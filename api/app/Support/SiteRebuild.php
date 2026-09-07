<?php

namespace App\Support;

use App\Models\SiteSetting;
use Illuminate\Support\Facades\Http;

/**
 * Asks the `web` container to rebuild the static public site.
 *
 * Extracted from WebsiteModuleController, which owned the only copy — so every
 * *other* thing the public site bakes had to remember to call a private method
 * on an unrelated controller, and hero images did not. Anything that changes
 * baked content belongs here rather than growing a second copy.
 */
final class SiteRebuild
{
    /**
     * Rebuild if the band has asked for automatic rebuilds.
     *
     * Call this after any write whose result the public site bakes. With
     * auto-rebuild off it does nothing, and the admin shows a manual button
     * instead — the two halves have to agree, or a save reports success and
     * changes nothing a visitor can see.
     */
    public static function requestIfAuto(): void
    {
        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            self::request();
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
}
