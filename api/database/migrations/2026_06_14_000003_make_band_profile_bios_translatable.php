<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE band_profiles SET bio_short           = json_object('en', bio_short)           WHERE bio_short           IS NOT NULL AND bio_short           NOT LIKE '{%'");
        DB::statement("UPDATE band_profiles SET bio_medium          = json_object('en', bio_medium)          WHERE bio_medium          IS NOT NULL AND bio_medium          NOT LIKE '{%'");
        DB::statement("UPDATE band_profiles SET bio_long            = json_object('en', bio_long)            WHERE bio_long            IS NOT NULL AND bio_long            NOT LIKE '{%'");
        DB::statement("UPDATE band_profiles SET bio_full            = json_object('en', bio_full)            WHERE bio_full            IS NOT NULL AND bio_full            NOT LIKE '{%'");
        DB::statement("UPDATE band_profiles SET artistic_statement  = json_object('en', artistic_statement)  WHERE artistic_statement  IS NOT NULL AND artistic_statement  NOT LIKE '{%'");

        Schema::table('band_profiles', function (Blueprint $table) {
            $table->json('bio_short')->nullable()->change();
            $table->json('bio_medium')->nullable()->change();
            $table->json('bio_long')->nullable()->change();
            $table->json('bio_full')->nullable()->change();
            $table->json('artistic_statement')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->string('bio_short', 280)->nullable()->change();
            $table->text('bio_medium')->nullable()->change();
            $table->text('bio_long')->nullable()->change();
            $table->text('bio_full')->nullable()->change();
            $table->text('artistic_statement')->nullable()->change();
        });

        DB::statement("UPDATE band_profiles SET bio_short          = JSON_UNQUOTE(JSON_EXTRACT(bio_short,          '$.en')) WHERE bio_short          IS NOT NULL");
        DB::statement("UPDATE band_profiles SET bio_medium         = JSON_UNQUOTE(JSON_EXTRACT(bio_medium,         '$.en')) WHERE bio_medium         IS NOT NULL");
        DB::statement("UPDATE band_profiles SET bio_long           = JSON_UNQUOTE(JSON_EXTRACT(bio_long,           '$.en')) WHERE bio_long           IS NOT NULL");
        DB::statement("UPDATE band_profiles SET bio_full           = JSON_UNQUOTE(JSON_EXTRACT(bio_full,           '$.en')) WHERE bio_full           IS NOT NULL");
        DB::statement("UPDATE band_profiles SET artistic_statement = JSON_UNQUOTE(JSON_EXTRACT(artistic_statement, '$.en')) WHERE artistic_statement IS NOT NULL");
    }
};
