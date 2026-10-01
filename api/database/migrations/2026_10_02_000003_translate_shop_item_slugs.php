<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;

/**
 * shop_items.slug_en / slug_pl -> shop_items.slug {"en": ..., "pl": ...}.
 * Translated-slug series, table 3 of 6; see TranslatedSlugColumns. Public
 * merch URLs are built from the default locale's slug, which is exactly the
 * old slug_en, so no URL moves.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('shop_items');
    }

    public function down(): void
    {
        TranslatedSlugColumns::toColumns('shop_items');
    }
};
