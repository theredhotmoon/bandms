<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            // Per-context logo overrides; fall back to the global is_default logo when null
            $table->foreignId('epk_logo_id')
                  ->nullable()->after('epk_album_id')
                  ->constrained('band_logos')->nullOnDelete();

            $table->foreignId('tech_rider_logo_id')
                  ->nullable()->after('epk_logo_id')
                  ->constrained('band_logos')->nullOnDelete();

            $table->foreignId('website_logo_id')
                  ->nullable()->after('tech_rider_logo_id')
                  ->constrained('band_logos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropForeign(['epk_logo_id']);
            $table->dropForeign(['tech_rider_logo_id']);
            $table->dropForeign(['website_logo_id']);
            $table->dropColumn(['epk_logo_id', 'tech_rider_logo_id', 'website_logo_id']);
        });
    }
};
