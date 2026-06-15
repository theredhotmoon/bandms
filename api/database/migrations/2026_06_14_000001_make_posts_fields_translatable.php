<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Wrap existing string values in {"en": ...} before changing column type.
        // The NOT LIKE check prevents double-wrapping on repeated runs.
        DB::statement("UPDATE posts SET title   = json_object('en', title)   WHERE title   IS NOT NULL AND title   NOT LIKE '{%'");
        DB::statement("UPDATE posts SET intro   = json_object('en', intro)   WHERE intro   IS NOT NULL AND intro   NOT LIKE '{%'");
        DB::statement("UPDATE posts SET content = json_object('en', content) WHERE content IS NOT NULL AND content NOT LIKE '{%'");

        Schema::table('posts', function (Blueprint $table) {
            $table->json('title')->change();
            $table->json('intro')->nullable()->change();
            $table->json('content')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('title')->change();
            $table->text('intro')->nullable()->change();
            $table->longText('content')->nullable()->change();
        });

        // Unwrap JSON back to the English string value.
        DB::statement("UPDATE posts SET title   = JSON_UNQUOTE(JSON_EXTRACT(title,   '$.en')) WHERE title   IS NOT NULL");
        DB::statement("UPDATE posts SET intro   = JSON_UNQUOTE(JSON_EXTRACT(intro,   '$.en')) WHERE intro   IS NOT NULL");
        DB::statement("UPDATE posts SET content = JSON_UNQUOTE(JSON_EXTRACT(content, '$.en')) WHERE content IS NOT NULL");
    }
};
