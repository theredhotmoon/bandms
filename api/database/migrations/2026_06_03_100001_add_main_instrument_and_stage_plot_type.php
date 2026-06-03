<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Map a named instrument to a visual icon type on stage plots and tech riders
        Schema::table('instruments', function (Blueprint $table) {
            $table->string('stage_plot_type', 64)->nullable()->after('category');
        });

        // One primary instrument per member — drives the stage-plot icon and tech-rider display
        Schema::table('band_members', function (Blueprint $table) {
            $table->foreignId('main_instrument_id')
                  ->nullable()
                  ->after('default_gear')
                  ->constrained('instruments')
                  ->nullOnDelete();
        });

        // Allow a per-instrument setup to share a monitor mix with another setup
        Schema::table('band_member_setups', function (Blueprint $table) {
            $table->foreignId('shared_monitor_id')
                  ->nullable()
                  ->after('instrument_id')
                  ->references('id')->on('band_member_setups')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('band_member_setups', function (Blueprint $table) {
            $table->dropForeign(['shared_monitor_id']);
            $table->dropColumn('shared_monitor_id');
        });

        Schema::table('band_members', function (Blueprint $table) {
            $table->dropForeign(['main_instrument_id']);
            $table->dropColumn('main_instrument_id');
        });

        Schema::table('instruments', function (Blueprint $table) {
            $table->dropColumn('stage_plot_type');
        });
    }
};
