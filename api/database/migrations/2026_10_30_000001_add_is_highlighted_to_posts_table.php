<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The post the band pins to the top of the News page. At most one row is
 * true — PostController::highlight() clears the others in the same
 * transaction; MySQL has no partial unique index to enforce it. With none
 * set, the public site falls back to the newest post.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_highlighted')->default(false)->after('event_date_display')->index();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['is_highlighted']);
            $table->dropColumn('is_highlighted');
        });
    }
};
