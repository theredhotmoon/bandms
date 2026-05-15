<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concert_band', function (Blueprint $table) {
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->foreignId('band_id')->constrained()->cascadeOnDelete();
            $table->primary(['concert_id', 'band_id']);
            $table->index('band_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concert_band');
    }
};
