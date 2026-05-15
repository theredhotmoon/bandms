<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_concerts', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'concert_id']);
        });

        Schema::create('post_albums', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('album_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'album_id']);
        });

        Schema::create('post_releases', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('release_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'release_id']);
        });

        Schema::create('post_tours', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tour_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'tour_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_tours');
        Schema::dropIfExists('post_releases');
        Schema::dropIfExists('post_albums');
        Schema::dropIfExists('post_concerts');
    }
};
