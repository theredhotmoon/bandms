<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a published post's text or pictures last changed — what search engines
 * are told as its modified date.
 *
 * Not `updated_at`: pinning a post, linking an album or a maintenance query
 * moves that, and an edit to the body alone never did (blocks are their own
 * rows). Null for every existing post: nothing recorded when they were really
 * edited, and a wrong date is worse than none.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->timestamp('content_updated_at')->nullable()->after('published_at');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('content_updated_at');
        });
    }
};
