<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('press_release_concerts', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'concert_id']);
        });

        Schema::create('press_release_posts', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'post_id']);
        });

        Schema::create('press_release_albums', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('album_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'album_id']);
        });

        Schema::create('press_release_releases', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('release_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'release_id']);
        });

        Schema::create('press_release_tours', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tour_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'tour_id']);
        });

        Schema::create('press_release_tags', function (Blueprint $table) {
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['press_release_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('press_release_tags');
        Schema::dropIfExists('press_release_tours');
        Schema::dropIfExists('press_release_releases');
        Schema::dropIfExists('press_release_albums');
        Schema::dropIfExists('press_release_posts');
        Schema::dropIfExists('press_release_concerts');
    }
};
