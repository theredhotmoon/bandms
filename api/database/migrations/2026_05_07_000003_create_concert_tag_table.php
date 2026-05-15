<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concert_tag', function (Blueprint $table) {
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['concert_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concert_tag');
    }
};
