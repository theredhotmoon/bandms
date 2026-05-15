<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('music_videos', function (Blueprint $table) {
            $table->string('og_title')->nullable()->after('video_url');
            $table->string('og_image', 1000)->nullable()->after('og_title');
            $table->string('og_site_name')->nullable()->after('og_image');
            $table->string('channel_name')->nullable()->after('og_site_name');
        });
    }

    public function down(): void
    {
        Schema::table('music_videos', function (Blueprint $table) {
            $table->dropColumn(['og_title', 'og_image', 'og_site_name', 'channel_name']);
        });
    }
};
