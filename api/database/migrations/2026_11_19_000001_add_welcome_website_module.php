<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Registers the `welcome` row so the welcome screen's copy is editable through
 * the usual page-copy form. Like `home`/`privacy`/`site` it has no route of its
 * own; unlike them it ships disabled — the band opts in.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('website_modules')->insertOrIgnore([
            'slug'         => 'welcome',
            'display_name' => 'Welcome screen',
            'custom_name'  => json_encode(['pl' => 'Ekran powitalny'], JSON_UNESCAPED_UNICODE),
            'enabled'      => false,
            'sort_order'   => 93,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('website_modules')->where('slug', 'welcome')->delete();
    }
};
