<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;

/**
 * tags.slug_en / tags.slug_pl -> tags.slug {"en": ..., "pl": ...}.
 * First of the translated-slug series; see TranslatedSlugColumns.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('tags');
    }

    public function down(): void
    {
        TranslatedSlugColumns::toColumns('tags');
    }
};
