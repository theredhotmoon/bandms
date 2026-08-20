<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the plain VARCHAR name added in the previous migration
        Schema::table('concerts', function (Blueprint $table) {
            $table->dropColumn('name');
        });

        // Re-add name as longText for Spatie JSON translations
        Schema::table('concerts', function (Blueprint $table) {
            $table->longText('name')->nullable()->after('id');
        });

        // Wrap any existing plain-text descriptions into JSON {"en":"..."}
        DB::statement("
            UPDATE concerts
            SET description = JSON_OBJECT('en', description)
            WHERE description IS NOT NULL
              AND description != ''
              AND JSON_VALID(description) = 0
        ");

        // Change description column to longText for Spatie
        Schema::table('concerts', function (Blueprint $table) {
            $table->longText('description')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Restore description to plain EN string
        DB::statement("
            UPDATE concerts
            SET description = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(description, '$.en')), description)
            WHERE JSON_VALID(description) = 1
        ");

        Schema::table('concerts', function (Blueprint $table) {
            $table->string('description')->nullable()->change();
            $table->dropColumn('name');
        });

        Schema::table('concerts', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
        });
    }
};
