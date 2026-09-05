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
        DB::statement("UPDATE tags SET name = json_object('en', name) WHERE name IS NOT NULL AND name NOT LIKE '{%'");

        // MySQL refuses to index a JSON column directly (error 1170/3152) —
        // uniqueness moves to the application layer, checked per locale via
        // Rule::unique('tags', "name->{locale}") in TagController, since a
        // whole-JSON-blob unique constraint can't express "unique per language"
        // anyway.
        Schema::table('tags', function (Blueprint $table) {
            $table->dropUnique('tags_name_unique');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->json('name')->change();
        });
    }

    public function down(): void
    {
        Schema::table('tags', function (Blueprint $table) {
            $table->string('name')->change();
        });

        // Unwrap JSON back to the English string value.
        DB::statement("UPDATE tags SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) WHERE name IS NOT NULL");

        Schema::table('tags', function (Blueprint $table) {
            $table->unique('name');
        });
    }
};
