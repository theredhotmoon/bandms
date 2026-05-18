<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('music_videos', function (Blueprint $table) {
            $table->unsignedBigInteger('view_count')->nullable()->default(null)->after('channel_name');
            $table->timestamp('views_synced_at')->nullable()->default(null)->after('view_count');
        });
    }

    public function down(): void
    {
        Schema::table('music_videos', function (Blueprint $table) {
            $table->dropColumn(['view_count', 'views_synced_at']);
        });
    }
};
