<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hero_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();

            // 'main', 'home', or a website_modules.slug. Deliberately not a
            // foreign key: two of the three legal values are not module rows,
            // and validation against live modules happens in the controller —
            // the same shape faqs.module_slug uses.
            $table->string('scope');

            // Explicit, written from the payload index. Never inferred from id:
            // writes are delete-and-recreate today, so id order agrees by
            // accident, and anything that stops recreating scrambles the
            // editor's drag order silently.
            $table->unsignedSmallInteger('position')->default(0);

            $table->timestamps();
            $table->index(['scope', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hero_images');
    }
};
