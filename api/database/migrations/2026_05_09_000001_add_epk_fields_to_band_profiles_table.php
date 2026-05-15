<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->unsignedSmallInteger('formation_year')->nullable()->after('bio_full');
            $table->string('hometown')->nullable()->after('formation_year');
            $table->string('genres', 500)->nullable()->after('hometown');
            $table->string('comparable_artists', 500)->nullable()->after('genres');
            $table->string('booking_email')->nullable()->after('comparable_artists');
            $table->string('press_email')->nullable()->after('booking_email');
            $table->text('artistic_statement')->nullable()->after('press_email');
            $table->unsignedBigInteger('stat_spotify_monthly')->nullable()->after('artistic_statement');
            $table->unsignedBigInteger('stat_instagram_followers')->nullable()->after('stat_spotify_monthly');
            $table->unsignedBigInteger('stat_tiktok_followers')->nullable()->after('stat_instagram_followers');
            $table->unsignedBigInteger('stat_youtube_subscribers')->nullable()->after('stat_tiktok_followers');
            $table->unsignedBigInteger('stat_facebook_followers')->nullable()->after('stat_youtube_subscribers');
            $table->string('tech_rider_path')->nullable()->after('stat_facebook_followers');
            $table->string('stage_plot_path')->nullable()->after('tech_rider_path');
            $table->foreignId('epk_release_id')->nullable()->after('stage_plot_path')
                ->constrained('releases')->nullOnDelete();
            $table->foreignId('epk_album_id')->nullable()->after('epk_release_id')
                ->constrained('albums')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropForeign(['epk_release_id']);
            $table->dropForeign(['epk_album_id']);
            $table->dropColumn([
                'formation_year', 'hometown', 'genres', 'comparable_artists',
                'booking_email', 'press_email', 'artistic_statement',
                'stat_spotify_monthly', 'stat_instagram_followers', 'stat_tiktok_followers',
                'stat_youtube_subscribers', 'stat_facebook_followers',
                'tech_rider_path', 'stage_plot_path', 'epk_release_id', 'epk_album_id',
            ]);
        });
    }
};
