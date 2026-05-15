<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->dropIndex('concerts_date_time_index');
            $table->renameColumn('time', 'start_time');
            $table->time('doors_open')->nullable()->after('date');
            $table->unsignedTinyInteger('own_sort_order')->default(1)->after('start_time');
            $table->index(['date', 'start_time']);
        });

        Schema::table('concert_band', function (Blueprint $table) {
            $table->unsignedTinyInteger('sort_order')->default(99)->after('band_id');
            $table->time('play_time')->nullable()->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('concert_band', function (Blueprint $table) {
            $table->dropColumn(['sort_order', 'play_time']);
        });

        Schema::table('concerts', function (Blueprint $table) {
            $table->dropIndex('concerts_date_start_time_index');
            $table->dropColumn(['doors_open', 'own_sort_order']);
            $table->renameColumn('start_time', 'time');
            $table->index(['date', 'time']);
        });
    }
};
