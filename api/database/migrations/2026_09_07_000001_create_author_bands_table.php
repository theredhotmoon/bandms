<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('author_bands', function (Blueprint $table) {
            $table->foreignId('author_id')->constrained()->cascadeOnDelete();
            $table->foreignId('band_id')->constrained()->cascadeOnDelete();
            $table->primary(['author_id', 'band_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('author_bands');
    }
};
