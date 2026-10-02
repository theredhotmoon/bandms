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

        // Every row without an English slug — not only fully empty ones. The old
        // update path could leave slug_en null with slug_pl set ({"pl": …} now),
        // and that concert is served at concert-{id} too (#154's review).
        foreach (DB::table('concerts')->orderBy('id')->get(['id', 'slug']) as $row) {
            $bag = json_decode((string) $row->slug, true) ?: [];
            if (blank($bag['en'] ?? null)) {
                $bag['en'] = "concert-{$row->id}";
                DB::table('concerts')->where('id', $row->id)->update(['slug' => json_encode($bag)]);
            }
        }
    }

    public function down(): void
    {
        // The concert-{id} values written above come back as slug_en. The API's
        // fallback served exactly that string, so every URL is unchanged.
        TranslatedSlugColumns::toColumns('concerts');
    }
};
