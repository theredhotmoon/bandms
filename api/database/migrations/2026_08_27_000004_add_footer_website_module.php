<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Registers the site footer as a configurable module.
 *
 * The footer is chrome, not a page — it has no route and no URL — but it does
 * carry editable copy (tagline, column headings, the booking blurb, the rights
 * line) and it is reasonable to want it off entirely. Both of those already have
 * plumbing on a website_modules row: `settings` for the copy and `enabled` for
 * the toggle, plus the admin editor that renders whatever
 * app/src/config/moduleSettings.ts declares.
 *
 * Because it is not a page, `custom_slug` and `per_page` are meaningless here.
 * The admin hides those fields for non-page modules rather than offering inputs
 * that do nothing, and neither Header.astro's MODULE_SLUGS nor
 * [lang]/[section].astro's section lists include `footer`, so no nav entry or
 * route can appear for it.
 *
 * sort_order 90 keeps it below the page modules in the reorderable list, where
 * dragging it has no effect on anything.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('website_modules')->insertOrIgnore([[
            'slug'         => 'footer',
            'display_name' => 'Footer',
            'custom_name'  => json_encode(['pl' => 'Stopka'], JSON_UNESCAPED_UNICODE),
            'enabled'      => true,
            'sort_order'   => 90,
            'settings'     => json_encode([
                'tagline' => [
                    'en' => 'SKA · SKA-JAZZ · ROCKSTEADY',
                    'pl' => 'SKA · SKA-JAZZ · ROCKSTEADY',
                ],
                'booking_title' => [
                    'en' => 'Booking & contact',
                    'pl' => 'Booking i kontakt',
                ],
                'booking_text' => [
                    'en' => "Festivals, clubs, private parties — let's make the room move.",
                    'pl' => 'Festiwale, kluby, prywatne imprezy — rozruszamy każdą salę.',
                ],
                'follow_title' => [
                    'en' => 'Follow',
                    'pl' => 'Obserwuj',
                ],
                'rights' => [
                    'en' => 'All rights reserved.',
                    'pl' => 'Wszelkie prawa zastrzeżone.',
                ],
            ], JSON_UNESCAPED_UNICODE),
            'created_at'   => now(),
            'updated_at'   => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('website_modules')->where('slug', 'footer')->delete();
    }
};
