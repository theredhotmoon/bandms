<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('press_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('band_profiles')->cascadeOnDelete();
            $table->string('url', 1000);
            $table->string('og_title')->nullable();
            $table->text('og_description')->nullable();
            $table->string('og_image', 1000)->nullable();
            $table->string('og_site_name')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('press_releases');
    }
};
