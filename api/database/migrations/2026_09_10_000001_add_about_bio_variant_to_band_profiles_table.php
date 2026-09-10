<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            // Which of bio_short/medium/long/full renders on the public About
            // page. 'medium' matches the hardcoded fallback this replaces, so
            // existing profiles keep their current public bio unchanged.
            $table->string('about_bio_variant', 10)->default('medium')->after('bio_full');
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropColumn('about_bio_variant');
        });
    }
};
