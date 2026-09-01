<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A social link belongs to exactly one owner: the band profile, a band
     * member, an author or a venue. `profile_id` was left NOT NULL when
     * `author_id`/`venue_id` were added, so every author- and venue-owned link
     * failed to insert with "Field 'profile_id' doesn't have a default value" —
     * after the parent row had already been committed.
     */
    public function up(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->unsignedBigInteger('profile_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->unsignedBigInteger('profile_id')->nullable(false)->change();
        });
    }
};
