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
        // Nullable first: a tag saved with only a Polish name (supported since
        // this migration's up()) has no `$.en` key, so the unwrap below can
        // produce NULL. Restoring NOT NULL happens only after every row has a
        // real value — doing it up front would fail the ALTER outright, and
        // MySQL DDL isn't transactional, so a failure here would otherwise
        // leave the column NOT NULL with a JSON string still inside it.
        Schema::table('tags', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
        });

        // Unwrap JSON back to a plain string, preferring English, falling
        // back to Polish, and finally a literal placeholder for the
        // (untested) case of a row with neither. Each step is guarded by
        // `LIKE '{%'` — once a row is unwrapped it's a plain string, not
        // valid JSON, so a later step's own JSON_EXTRACT on that same row
        // would fail outright rather than simply finding nothing.
        DB::statement("UPDATE tags SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) WHERE name LIKE '{%' AND JSON_EXTRACT(name, '$.en') IS NOT NULL");
        DB::statement("UPDATE tags SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.pl')) WHERE name LIKE '{%' AND JSON_EXTRACT(name, '$.pl') IS NOT NULL");
        DB::statement("UPDATE tags SET name = 'tag' WHERE name LIKE '{%'");

        Schema::table('tags', function (Blueprint $table) {
            $table->string('name')->nullable(false)->change();
            $table->unique('name');
        });
    }
};
