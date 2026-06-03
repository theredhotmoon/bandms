<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->json('gig_lineup')->nullable()->after('stage_plot_data');
        });
    }

    public function down(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->dropColumn('gig_lineup');
        });
    }
};
