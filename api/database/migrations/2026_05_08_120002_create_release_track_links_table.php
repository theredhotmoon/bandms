<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('release_track_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->constrained('release_tracks')->cascadeOnDelete();
            $table->string('platform');
            $table->string('url', 500);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('release_track_links');
    }
};
