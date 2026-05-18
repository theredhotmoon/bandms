<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->unsignedBigInteger('facebook_likes')->nullable()->after('stat_facebook_followers');
            $table->timestamp('facebook_likes_synced_at')->nullable()->after('facebook_likes');
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropColumn(['facebook_likes', 'facebook_likes_synced_at']);
        });
    }
};
