<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Promotes "About" from a hardcoded English-only page to a real CMS module.
 *
 * /about existed only as an unlocalised Astro page: absent from the nav, with no
 * Polish URL, and impossible to rename, reorder or switch off. Registering it
 * here makes it behave like every other section, and the design's navigation
 * includes it.
 *
 * Unlike the contact migration, slugs are stored explicitly from the outset —
 * `custom_slug` already exists by this point, so there is no label-derived
 * period to work around. `about` / `o-nas` are set directly rather than being
 * left to fall back to the module key, which would have served /pl/about.
 *
 * sort_order 12 places it after contact (11), which is where the reorderer will
 * leave it until someone drags it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('website_modules')->insertOrIgnore([[
            'slug'         => 'about',
            'display_name' => 'About',
            'custom_name'  => json_encode(['pl' => 'O nas'], JSON_UNESCAPED_UNICODE),
            'custom_slug'  => json_encode(['en' => 'about', 'pl' => 'o-nas']),
            'enabled'      => true,
            'sort_order'   => 12,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('website_modules')->where('slug', 'about')->delete();
    }
};
