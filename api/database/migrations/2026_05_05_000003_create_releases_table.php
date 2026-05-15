<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('band_profiles')->cascadeOnDelete();
            $table->string('title');
            $table->enum('type', ['LP', 'EP', 'single', 'compilation']);
            $table->date('release_date')->nullable();
            $table->string('cover_image')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('releases');
    }
};
