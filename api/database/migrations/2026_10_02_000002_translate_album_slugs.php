<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;

/**
 * albums.slug_en / albums.slug_pl -> albums.slug {"en": ..., "pl": ...}.
 * Translated-slug series, table 2 of 6; see TranslatedSlugColumns.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('albums');
    }

    public function down(): void
    {
        TranslatedSlugColumns::toColumns('albums');
    }
};
