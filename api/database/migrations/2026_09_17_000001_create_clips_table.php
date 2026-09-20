<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A library of video clips (live, studio, backstage…) attached to whatever
 * they document. `clippables` is a polymorphic many-to-many: one clip can sit
 * on a concert *and* the release it promotes. Posts are not owners — they
 * reference a clip through a `ref` block, which also decides where in the
 * article it sits.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clips', function (Blueprint $table) {
            $table->id();
            // Stamped by EmbedProvider::detect() on write and stored, so a
            // later change to detection cannot silently re-point old rows.
            $table->string('provider', 20);
            $table->string('url', 2048);
            $table->json('title')->nullable();
            $table->string('category', 64)->default('live');
            $table->date('recorded_on')->nullable();
            $table->boolean('show_in_epk')->default(false);
            $table->timestamps();
        });

        Schema::create('clippables', function (Blueprint $table) {
            $table->foreignId('clip_id')->constrained()->cascadeOnDelete();
            $table->string('clippable_type', 32);
            $table->unsignedBigInteger('clippable_id');
            $table->unsignedSmallInteger('position')->default(0);

            $table->unique(['clip_id', 'clippable_type', 'clippable_id']);
            $table->index(['clippable_type', 'clippable_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clippables');
        Schema::dropIfExists('clips');
    }
};
