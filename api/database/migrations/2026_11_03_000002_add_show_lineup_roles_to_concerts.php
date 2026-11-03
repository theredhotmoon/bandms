<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a show page labels its line-up "Headliner" / "Support".
 *
 * Not every gig is billed that way — a festival slot, a split bill, a
 * jam night — so the band switches the words off per concert. Default
 * on: every page built before this column keeps the labels it had.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->boolean('show_lineup_roles')->default(true)->after('own_sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->dropColumn('show_lineup_roles');
        });
    }
};
