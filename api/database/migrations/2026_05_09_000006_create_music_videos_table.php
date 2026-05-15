<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('music_videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('band_profiles')->cascadeOnDelete();
            $table->string('title');
            $table->string('video_url');
            $table->date('published_at')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('music_videos');
    }
};
