<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop pivot tables that reference photos columns we're removing
        Schema::dropIfExists('photo_tag');

        Schema::table('photos', function (Blueprint $table) {
            $table->foreignId('album_id')->nullable()->constrained()->nullOnDelete()->after('id');
            $table->string('caption')->nullable()->after('album_id');
        });

        Schema::table('photos', function (Blueprint $table) {
            $table->dropForeign(['venue_id']);
            $table->dropForeign(['concert_id']);
            $table->dropColumn(['title', 'slug', 'description', 'venue_id', 'concert_id', 'taken_at', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->string('title')->default('');
            $table->string('slug')->unique()->default('');
            $table->text('description')->nullable();
            $table->foreignId('venue_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('concert_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('taken_at')->nullable();
            $table->dateTime('published_at')->nullable();
            $table->dropForeign(['album_id']);
            $table->dropColumn(['album_id', 'caption']);
        });

        Schema::create('photo_tag', function (Blueprint $table) {
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['photo_id', 'tag_id']);
        });
    }
};
