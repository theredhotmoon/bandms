<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_music_videos', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('music_video_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'music_video_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_music_videos');
    }
};
