<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concert_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('url', 500);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concert_links');
    }
};
