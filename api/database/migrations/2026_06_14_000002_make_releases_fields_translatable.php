<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE releases SET title       = json_object('en', title)       WHERE title       IS NOT NULL AND title       NOT LIKE '{%'");
        DB::statement("UPDATE releases SET description = json_object('en', description) WHERE description IS NOT NULL AND description NOT LIKE '{%'");

        Schema::table('releases', function (Blueprint $table) {
            $table->json('title')->change();
            $table->json('description')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('releases', function (Blueprint $table) {
            $table->string('title')->change();
            $table->text('description')->nullable()->change();
        });

        DB::statement("UPDATE releases SET title       = JSON_UNQUOTE(JSON_EXTRACT(title,       '$.en')) WHERE title       IS NOT NULL");
        DB::statement("UPDATE releases SET description = JSON_UNQUOTE(JSON_EXTRACT(description, '$.en')) WHERE description IS NOT NULL");
    }
};
