<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Our band's own stage time within the line-up.
 *
 * The line-up used to print `start_time` against our band — the show's
 * start, which is the opening act's slot whenever we headline. Null means
 * "same as start_time", so every page built before this keeps its time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->time('own_play_time')->nullable()->after('own_sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->dropColumn('own_play_time');
        });
    }
};
