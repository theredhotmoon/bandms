<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->foreignId('author_id')->nullable()->after('member_id')
                ->constrained('authors')->cascadeOnDelete();
            $table->foreignId('venue_id')->nullable()->after('author_id')
                ->constrained('venues')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->dropForeign(['author_id']);
            $table->dropForeign(['venue_id']);
            $table->dropColumn(['author_id', 'venue_id']);
        });
    }
};
