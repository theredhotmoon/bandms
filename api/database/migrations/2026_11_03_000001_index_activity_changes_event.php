<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A manual rebuild finds the previous one with MAX(activity_log_id) WHERE
 * event = 'rebuilt', and the Action filter matches rebuilds by event. The
 * table is never pruned, so without this both scan every itemised field of
 * every save ever logged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_changes', function (Blueprint $table) {
            $table->index(['event', 'activity_log_id']);
        });
    }

    public function down(): void
    {
        Schema::table('activity_changes', function (Blueprint $table) {
            $table->dropIndex(['event', 'activity_log_id']);
        });
    }
};
