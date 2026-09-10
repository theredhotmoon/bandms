<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-module boolean section toggles — a second generic bag alongside
 * `settings`, kept separate rather than merged into it.
 *
 * `settings` validates every key as a per-locale string ({field: {en, pl}}),
 * and Laravel can't apply two conflicting shapes to the same wildcard
 * ("settings.*"), so a boolean field can't live there without special-casing
 * every read/write path that already assumes translatable copy. `visibility`
 * is the same "additive, no-migration field" pattern applied to a different
 * value type: {"<field>": true|false}, no locale dimension — a section is
 * either shown or it isn't, not translated per language.
 *
 * First consumer: the About page's "Band in numbers" stats grid
 * (show_stats) and line-up grid (show_members), both currently unconditional
 * chrome around content that may or may not exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->json('visibility')->nullable()->after('settings');
        });
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn('visibility');
        });
    }
};
