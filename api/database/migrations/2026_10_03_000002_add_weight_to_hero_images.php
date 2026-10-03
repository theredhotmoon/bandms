<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An optional display weight per hero picture, 1–100. NULL means maximum —
 * every picture behaved that way before the column existed, so nothing changes
 * until a band sets one. It can only lower how often a picture shows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->unsignedTinyInteger('weight')->nullable()->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropColumn('weight');
        });
    }
};
