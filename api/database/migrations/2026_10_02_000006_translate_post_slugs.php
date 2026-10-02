<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;

/**
 * posts.slug_en / slug_pl -> posts.slug {"en": ..., "pl": ...}.
 * Translated-slug series, table 6 of 6 — the last; see TranslatedSlugColumns.
 *
 * Posts are the one table routed PER LANGUAGE: /pl/ serves the Polish slug,
 * falling back to the English one. That resolution moves to the public site's
 * locale chain over translations.slug and gives the same URL for every post.
 * The only rows whose /pl/ URL could change are ones whose slug_pl equalled
 * ANOTHER post's slug_en — and those were already shadowed, because since #83
 * nothing can create them and before it Astro built only one of the two pages.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('posts');
    }

    public function down(): void
    {
        TranslatedSlugColumns::toColumns('posts');
    }
};
