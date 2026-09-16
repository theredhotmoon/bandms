<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Registers three rows that exist so their copy is editable, the way `footer`
 * already does (2026_08_27_000004).
 *
 * Every string on the public site now resolves through the @bandms/site-copy
 * registry, keyed by website_modules.slug, and overridden from the row's
 * `settings` bag. Three surfaces had no row to hang their strings on:
 *
 *  - `home`    — the homepage. A page, but at a fixed route (`/{lang}`) with no
 *                slug to move, so the admin hides the URL and per-page inputs.
 *  - `privacy` — the privacy policy at `/{lang}/privacy`, plus the cookie
 *                banner that links to it. Fixed route, same treatment.
 *  - `site`    — chrome that belongs to no page: navigation labels, the FAQ
 *                block every section embeds, the 404 page.
 *
 * None of them takes a hero image, appears in the nav, or is offered as an FAQ
 * category — the admin filters all of that on NON_PAGE_MODULES. The Astro
 * section lists do not include them either, so no route can appear by
 * accident. `enabled` is meaningless for `home` and `site` and is ignored by
 * the public build.
 *
 * No settings are seeded: the registry carries the defaults, and an empty bag
 * means "print the defaults" — which is also what a database predating this
 * migration gets, since the public site never reads the row for anything but
 * overrides.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('website_modules')->insertOrIgnore([
            [
                'slug'         => 'home',
                'display_name' => 'Homepage',
                'custom_name'  => json_encode(['pl' => 'Strona główna'], JSON_UNESCAPED_UNICODE),
                'enabled'      => true,
                // 89–92 keep all four fixed rows together below the reorderable
                // page modules, where dragging them has no effect on anything.
                'sort_order'   => 89,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'slug'         => 'privacy',
                'display_name' => 'Privacy & cookies',
                'custom_name'  => json_encode(['pl' => 'Prywatność i cookies'], JSON_UNESCAPED_UNICODE),
                'enabled'      => true,
                'sort_order'   => 91,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'slug'         => 'site',
                'display_name' => 'Site-wide',
                'custom_name'  => json_encode(['pl' => 'Cała strona'], JSON_UNESCAPED_UNICODE),
                'enabled'      => true,
                'sort_order'   => 92,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('website_modules')->whereIn('slug', ['home', 'privacy', 'site'])->delete();
    }
};
