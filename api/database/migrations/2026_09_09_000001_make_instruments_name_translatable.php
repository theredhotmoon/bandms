<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    public function up(): void
    {
        // Wrap existing string values in {"en": ...} before changing column type.
        // The NOT LIKE check prevents double-wrapping on repeated runs.
        DB::statement("UPDATE instruments SET name = json_object('en', name) WHERE name IS NOT NULL AND name NOT LIKE '{%'");

        Schema::table('instruments', function (Blueprint $table) {
            $table->json('name')->change();
        });
    }

    public function down(): void
    {
        // Nullable first: an instrument saved with only a Polish name
        // (supported since this migration's up()) has no `$.en` key, so the
        // unwrap below can produce NULL. Restoring NOT NULL happens only
        // after every row has a real value.
        Schema::table('instruments', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
        });

        // Unwrap JSON back to a plain string, preferring English, falling
        // back to Polish, and finally a literal placeholder. Each step is
        // guarded by `LIKE '{%'` — once a row is unwrapped it's a plain
        // string, not valid JSON, so a later step's JSON_EXTRACT on that same
        // row would fail outright rather than simply finding nothing.
        DB::statement("UPDATE instruments SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) WHERE name LIKE '{%' AND JSON_EXTRACT(name, '$.en') IS NOT NULL");
        DB::statement("UPDATE instruments SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.pl')) WHERE name LIKE '{%' AND JSON_EXTRACT(name, '$.pl') IS NOT NULL");
        DB::statement("UPDATE instruments SET name = 'instrument' WHERE name LIKE '{%'");

        Schema::table('instruments', function (Blueprint $table) {
            $table->string('name')->nullable(false)->change();
        });
    }
};
