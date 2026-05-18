<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('setlist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('setlist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('song_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(1);
            $table->boolean('is_encore')->default(false);
            $table->enum('transition', ['pause', 'segue', 'talk', 'end'])->nullable();
            $table->string('lighting_cue')->nullable();
            $table->string('sound_note')->nullable();
            $table->json('member_notes')->nullable();
            $table->unsignedSmallInteger('override_duration_sec')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('setlist_items');
    }
};
