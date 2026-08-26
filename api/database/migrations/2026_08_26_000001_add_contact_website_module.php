<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Promotes "Contact" from a hardcoded public-site section to a real CMS module.
 *
 * Before this, /contact was always rendered, always present in the nav, and its
 * label + per-locale slug were hardcoded in web/src (Header, Footer, slugs.ts).
 * Registering it here makes it behave like every other section: toggleable,
 * renameable per locale, and reorderable from /admin/website-modules.
 *
 * The PL custom name is seeded so the existing /pl/kontakt URL keeps working —
 * the public slug is derived from the label, and without it the Polish page
 * would silently move to /pl/contact.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('website_modules')->insertOrIgnore([[
            'slug'         => 'contact',
            'display_name' => 'Contact',
            'custom_name'  => json_encode(['pl' => 'Kontakt']),
            'enabled'      => true,
            'sort_order'   => 11,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('website_modules')->where('slug', 'contact')->delete();
    }
};
