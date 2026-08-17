<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes the stage placements the single source of truth for a rider.
 *
 * Before: a rider stored the same technical data three times — once in
 * band_member_setups, once copied into stage_plot_data, and once flattened
 * again into tech_riders.inputs/monitors/backline/power/rf_wireless. The three
 * copies were synced by hand and drifted silently.
 *
 * After: a placement references a band_member_setups row and carries only a
 * sparse per-gig override. The flat lists are derived at render time, so the
 * columns that stored them are gone. What remains on the rider is what belongs
 * to no single musician: extra channels (talkback, playback), the manual
 * channel order, PA/FOH, and the stage-wide power notes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_member_setups', function (Blueprint $table) {
            // A member can run a wedge *and* an IEM. Singular `monitor` silently
            // dropped the second one on every round-trip through the stage plot.
            $table->dropColumn('monitor');
            $table->json('monitors')->nullable()->after('signal_chain_type');
        });

        Schema::table('tech_riders', function (Blueprint $table) {
            // stage_plot_data no longer holds a plot — it holds the rider.
            $table->renameColumn('stage_plot_data', 'placements');
        });

        Schema::table('tech_riders', function (Blueprint $table) {
            $table->dropColumn(['inputs', 'monitors', 'backline', 'power', 'rf_wireless']);

            // Requirements that belong to the production, not to a musician.
            $table->json('extra_inputs')->nullable()->after('placements');
            $table->json('extra_monitors')->nullable()->after('extra_inputs');
            $table->json('extra_backline')->nullable()->after('extra_monitors');
            $table->json('extra_wireless')->nullable()->after('extra_backline');

            // Engineer-chosen channel order: resolved row keys, first to last.
            // Unknown keys are ignored and missing ones appended, so it never
            // needs to stay in step with the placements by itself.
            $table->json('channel_order')->nullable()->after('extra_wireless');

            // Stage-wide power figures. Per-position outlets come from placements.
            $table->json('power_notes')->nullable()->after('channel_order');
        });
    }

    public function down(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->dropColumn([
                'extra_inputs', 'extra_monitors', 'extra_backline',
                'extra_wireless', 'channel_order', 'power_notes',
            ]);

            $table->json('inputs')->nullable();
            $table->json('monitors')->nullable();
            $table->json('backline')->nullable();
            $table->json('power')->nullable();
            $table->json('rf_wireless')->nullable();
        });

        Schema::table('tech_riders', function (Blueprint $table) {
            $table->renameColumn('placements', 'stage_plot_data');
        });

        Schema::table('band_member_setups', function (Blueprint $table) {
            $table->dropColumn('monitors');
            $table->json('monitor')->nullable()->after('signal_chain_type');
        });
    }
};
