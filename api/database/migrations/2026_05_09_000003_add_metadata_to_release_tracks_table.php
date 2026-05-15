<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('release_tracks', function (Blueprint $table) {
            $table->unsignedSmallInteger('bpm')->nullable()->after('sort_order');
            $table->string('musical_key', 10)->nullable()->after('bpm');
            $table->string('mood_tags', 500)->nullable()->after('musical_key');
            $table->string('isrc', 20)->nullable()->after('mood_tags');
            $table->boolean('explicit')->default(false)->after('isrc');
            $table->boolean('stems_available')->default(false)->after('explicit');
            $table->string('sync_placements', 1000)->nullable()->after('stems_available');
        });
    }

    public function down(): void
    {
        Schema::table('release_tracks', function (Blueprint $table) {
            $table->dropColumn(['bpm', 'musical_key', 'mood_tags', 'isrc', 'explicit', 'stems_available', 'sync_placements']);
        });
    }
};
