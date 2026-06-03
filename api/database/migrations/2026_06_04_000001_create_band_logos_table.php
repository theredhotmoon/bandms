<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('band_logos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('band_profiles')->cascadeOnDelete();

            // File storage
            $table->string('file_path', 1000);
            $table->string('original_name', 255);
            $table->string('mime_type', 100);           // image/png, image/svg+xml, image/jpeg, image/webp
            $table->unsignedBigInteger('file_size')->nullable();   // bytes
            $table->unsignedSmallInteger('width')->nullable();     // px (null for SVG)
            $table->unsignedSmallInteger('height')->nullable();

            // Classification
            $table->string('label', 255)->nullable();  // "Horizontal white", "Square dark"
            // variant: full | icon | horizontal | stacked | wordmark
            $table->string('variant', 64)->default('full');
            // background: light | dark | transparent | any
            $table->string('background', 32)->default('any');

            // Status
            $table->boolean('is_default')->default(false);
            $table->boolean('is_deprecated')->default(false);

            // Version history
            $table->string('version_label', 100)->nullable();  // "Original 2018", "Rebrand 2023"
            $table->text('notes')->nullable();

            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('band_logos');
    }
};
