<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('epk_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('version_number');
            $table->text('release_reason')->nullable();
            $table->longText('snapshot');
            $table->enum('status', ['pending', 'published', 'archived'])->default('pending');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('epk_versions');
    }
};
