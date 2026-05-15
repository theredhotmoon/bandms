<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            // 1=Foundation, 2=Growing, 3=Touring, 4=Professional
            $table->tinyInteger('career_level')->unsigned()->default(1)->after('tech_rider_notes');
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropColumn('career_level');
        });
    }
};
