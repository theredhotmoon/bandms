<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-page content width: 'full' lets a page's content run to the gutters,
 * 'limited' caps it to the site's content measure (--page-max on the public
 * site). Only the content box moves — section backgrounds stay full-bleed.
 *
 * A column, not a `visibility` key: that bag holds show/hide booleans, and a
 * width is neither shown nor hidden. Not `settings` either, which validates
 * every field as per-locale copy.
 *
 * 'full' is the default because the design is full width. The pages seeded
 * 'limited' are the ones that were capped on the day this landed — News,
 * Shows, About and Shop by hardcoded max-widths, Home and Contact at the
 * band's request — so no page goes from capped to edge-to-edge. Shop was
 * 1280px and is now the shared 1200px measure.
 *
 * This only reaches rows that exist when it runs. A fresh database gets
 * concerts, posts and merch from DatabaseSeeder afterwards, which seeds
 * the same values itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->string('content_width', 8)->default('full')->after('visibility');
        });

        DB::table('website_modules')
            ->whereIn('slug', ['home', 'contact', 'posts', 'concerts', 'about', 'merch'])
            ->update(['content_width' => 'limited']);
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn('content_width');
        });
    }
};
