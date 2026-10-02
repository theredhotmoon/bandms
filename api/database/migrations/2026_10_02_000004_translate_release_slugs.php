<?php

use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Migrations\Migration;

/**
 * releases.slug_en / slug_pl -> releases.slug {"en": ..., "pl": ...}.
 * Translated-slug series, table 4 of 6; see TranslatedSlugColumns. Releases
 * are routed by id, so no public URL depends on these.
 */
return new class extends Migration
{
    public function up(): void
    {
        TranslatedSlugColumns::toBag('releases');
    }

    public function down(): void
    {
        TranslatedSlugColumns::toColumns('releases');
    }
};
