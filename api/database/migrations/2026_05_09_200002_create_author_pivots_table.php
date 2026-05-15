<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('author_press_releases', function (Blueprint $table) {
            $table->foreignId('author_id')->constrained()->cascadeOnDelete();
            $table->foreignId('press_release_id')->constrained()->cascadeOnDelete();
            $table->primary(['author_id', 'press_release_id']);
        });

        Schema::create('author_concerts', function (Blueprint $table) {
            $table->foreignId('author_id')->constrained()->cascadeOnDelete();
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->primary(['author_id', 'concert_id']);
        });

        Schema::create('author_tours', function (Blueprint $table) {
            $table->foreignId('author_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tour_id')->constrained()->cascadeOnDelete();
            $table->primary(['author_id', 'tour_id']);
        });

        Schema::create('author_photos', function (Blueprint $table) {
            $table->foreignId('author_id')->constrained()->cascadeOnDelete();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->primary(['author_id', 'photo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('author_photos');
        Schema::dropIfExists('author_tours');
        Schema::dropIfExists('author_concerts');
        Schema::dropIfExists('author_press_releases');
    }
};
