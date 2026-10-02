<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * concerts.slug_en / slug_pl -> concerts.slug {"en": ..., "pl": ...}.
 * Translated-slug series, table 5 of 6; see TranslatedSlugColumns.
 *
 * Concert URLs are built from the default locale's slug in every language, and
 * a concert with no slug_en has always been served at /…/concert-{id} — the
 * API's fallback. That fallback is written in as real data here: left null,
 * the first save after this migration would GENERATE a default slug (the
 * generate-once policy fills a missing one) and move that concert's page.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('concerts');

        foreach (DB::table('concerts')->whereNull('slug')->pluck('id') as $id) {
            DB::table('concerts')->where('id', $id)->update(['slug' => json_encode(['en' => "concert-{$id}"])]);
        }
    }

    public function down(): void
    {
        // The concert-{id} values written above come back as slug_en. The API's
        // fallback served exactly that string, so every URL is unchanged.
        TranslatedSlugColumns::toColumns('concerts');
    }
};
