<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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
 *
 * The JSON payloads are rewritten in place as well, not just the columns. The
 * rig vocabulary changed shape underneath them — `backline` became a list,
 * monitors and wireless units gained ids, `channel` left the input rows — and
 * App\Http\Requests\Concerns\ValidatesRig now enforces that shape. A row left
 * in the old shape would render with nothing on it and then 422 on the next
 * save, so every row is normalised here.
 */
return new class extends Migration
{
    private const BACKLINE_CATEGORIES = ['drum_kit', 'guitar_amp', 'bass_amp', 'keyboard', 'other'];

    private const WIRELESS_TYPES = ['instrument', 'vocal', 'iem', 'other'];

    public function up(): void
    {
        // ── band_member_setups ────────────────────────────────────────────────
        // Read before dropping: `monitor` is the only copy of the monitor spec.
        $setups = DB::table('band_member_setups')
            ->select('id', 'monitor', 'inputs', 'backline', 'power', 'wireless')
            ->get();

        Schema::table('band_member_setups', function (Blueprint $table) {
            // A member can run a wedge *and* an IEM. Singular `monitor` silently
            // dropped the second one on every round-trip through the stage plot.
            $table->dropColumn('monitor');
            $table->json('monitors')->nullable()->after('signal_chain_type');
        });

        foreach ($setups as $setup) {
            DB::table('band_member_setups')->where('id', $setup->id)->update([
                // A single MemberMonitorPrefs object becomes a one-element list.
                'monitors' => json_encode($this->monitorList(
                    $this->decode($setup->monitor) === null ? [] : [$this->decode($setup->monitor)]
                )),
                'inputs'   => json_encode($this->inputList($this->decode($setup->inputs))),
                'backline' => json_encode($this->backlineList($this->decode($setup->backline))),
                'power'    => json_encode($this->power($this->decode($setup->power))),
                'wireless' => json_encode($this->wirelessList($this->decode($setup->wireless))),
            ]);
        }

        // ── tech_riders ───────────────────────────────────────────────────────
        Schema::table('tech_riders', function (Blueprint $table) {
            // stage_plot_data no longer holds a plot — it holds the rider.
            $table->renameColumn('stage_plot_data', 'placements');
        });

        // Old placements carried the whole rig inline and referenced no setup.
        // There is nothing to point `setup_id` at, so the inline rig becomes the
        // placement's override: the printed rider comes out identical, and the
        // engineer can link a saved rig later without losing anything first.
        // `get()`, not `cursor()`: an unbuffered cursor cannot stay open while
        // the loop issues UPDATEs on the same connection. A band has riders in
        // the dozens, so there is nothing to stream.
        foreach (DB::table('tech_riders')->select('id', 'placements')->get() as $rider) {
            $placements = $this->decode($rider->placements);

            if (! is_array($placements)) {
                continue;
            }

            DB::table('tech_riders')->where('id', $rider->id)->update([
                'placements' => json_encode(array_values(array_map(
                    fn ($item) => $this->placement($item),
                    array_filter($placements, 'is_array'),
                ))),
            ]);
        }

        Schema::table('tech_riders', function (Blueprint $table) {
            // The flat lists were a copy of the placements and are derived again
            // at render time, so they are dropped rather than migrated. Anything
            // in them that belonged to no musician (talkback, playback) cannot be
            // told apart from the copied rows and has to be re-entered under
            // extra_inputs — there is no rule that separates them after the fact.
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

    /**
     * Structural only. The rig payloads keep the new shape — going back would
     * mean choosing which monitor to discard and which backline item is "the"
     * one, and that is a decision no rollback should make silently.
     */
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

    // ── Payload normalisation ─────────────────────────────────────────────────

    /** One placement, old shape or new, in the reference + override shape. */
    private function placement(array $item): array
    {
        $normalised = [
            'id'             => $this->str($item['id'] ?? null) ?: $this->uid('pos'),
            'band_member_id' => isset($item['band_member_id']) ? (int) $item['band_member_id'] : null,
            'setup_id'       => isset($item['setup_id']) ? (int) $item['setup_id'] : null,
            'x'              => $this->coord($item['x'] ?? null),
            'y'              => $this->coord($item['y'] ?? null),
            'instruments'    => $this->instrumentList($item['instruments'] ?? null),
            'overrides'      => [],
        ];

        if (isset($item['temp_id']) && $this->str($item['temp_id']) !== '') {
            $normalised['temp_id'] = $this->str($item['temp_id']);
        }

        // Already the new shape: keep the override exactly as stored.
        if (array_key_exists('overrides', $item) && array_key_exists('setup_id', $item)) {
            $normalised['overrides'] = is_array($item['overrides']) ? $item['overrides'] : [];

            return $normalised;
        }

        $overrides = [];

        if (isset($item['signal_chain_type']) && is_string($item['signal_chain_type'])) {
            $overrides['signal_chain_type'] = $item['signal_chain_type'];
        }
        if (array_key_exists('inputs', $item)) {
            $overrides['inputs'] = $this->inputList($item['inputs']);
        }
        if (array_key_exists('monitors', $item)) {
            $overrides['monitors'] = $this->monitorList($item['monitors']);
        }
        if (array_key_exists('backline', $item)) {
            $overrides['backline'] = $this->backlineList($item['backline']);
        }
        if (array_key_exists('power', $item)) {
            $overrides['power'] = $this->power($item['power']);
        }
        if (array_key_exists('wireless', $item)) {
            $overrides['wireless'] = $this->wirelessList($item['wireless']);
        }
        if (isset($item['foh_notes']) && $this->str($item['foh_notes']) !== '') {
            $overrides['foh_notes'] = $this->str($item['foh_notes']);
        }

        $normalised['overrides'] = $overrides;

        return $normalised;
    }

    /** @return array<int, array<string, mixed>> */
    private function instrumentList(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_map(fn (array $i): array => [
            'id'    => $this->str($i['id'] ?? null) ?: $this->uid('inst'),
            'type'  => $this->str($i['type'] ?? null) ?: 'vocalist',
            'label' => $this->str($i['label'] ?? null),
            // Legacy slots carried a `setup_id` of their own. Nothing ever read
            // it — which rig a musician plays belongs to the placement, not to
            // one icon on it — so it is dropped rather than carried forward.
        ], array_filter($raw, 'is_array')));
    }

    /** @return array<int, array<string, mixed>> */
    private function inputList(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_map(fn (array $r): array => [
            'id'         => $this->str($r['id'] ?? null) ?: $this->uid('in'),
            'instrument' => $this->str($r['instrument'] ?? null),
            'mic_di'     => in_array($r['mic_di'] ?? null, ['Mic', 'DI', 'Mic+DI'], true) ? $r['mic_di'] : 'Mic',
            'mic_model'  => $this->str($r['mic_model'] ?? null),
            'stand_type' => $this->str($r['stand_type'] ?? null),
            'notes'      => $this->str($r['notes'] ?? null),
            // `channel` is deliberately dropped: numbers are assigned during
            // resolution, so a stored one could only ever be stale or duplicated.
        ], array_filter($raw, 'is_array')));
    }

    /** @return array<int, array<string, mixed>> */
    private function monitorList(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_map(fn (array $m): array => [
            'id'                    => $this->str($m['id'] ?? null) ?: $this->uid('mon'),
            'label'                 => $this->str($m['label'] ?? null),
            'type'                  => in_array($m['type'] ?? null, ['wedge', 'iem'], true) ? $m['type'] : 'wedge',
            'config'                => in_array($m['config'] ?? null, ['mono', 'stereo'], true) ? $m['config'] : 'mono',
            'mix_description'       => $this->str($m['mix_description'] ?? null),
            'iem_own_pack'          => (bool) ($m['iem_own_pack'] ?? false),
            'iem_transmitter_model' => $this->str($m['iem_transmitter_model'] ?? null),
            'iem_frequency'         => $this->str($m['iem_frequency'] ?? null),
        ], array_filter($raw, 'is_array')));
    }

    /**
     * Backline went from one object per musician to a list, so a musician can
     * ask for a drum kit *and* an amp.
     *
     * @return array<int, array<string, mixed>>
     */
    private function backlineList(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        // Already a list.
        if (array_is_list($raw)) {
            return array_values(array_map(fn (array $b): array => $this->backline($b), array_filter($raw, 'is_array')));
        }

        $item = $this->backline($raw);

        // An untouched legacy default carries nothing worth a row of its own.
        $empty = ! $item['needed']
            && $item['brand_preference'] === ''
            && $item['specs'] === ''
            && $item['notes'] === '';

        return $empty ? [] : [$item];
    }

    /** @return array<string, mixed> */
    private function backline(array $b): array
    {
        $category = $this->str($b['category'] ?? null);

        return [
            'id'               => $this->str($b['id'] ?? null) ?: $this->uid('bl'),
            'needed'           => (bool) ($b['needed'] ?? false),
            'category'         => in_array($category, self::BACKLINE_CATEGORIES, true) ? $category : 'other',
            'name'             => $this->str($b['name'] ?? null),
            'brand_preference' => $this->str($b['brand_preference'] ?? null),
            'specs'            => $this->str($b['specs'] ?? null),
            'notes'            => $this->str($b['notes'] ?? null),
        ];
    }

    /** @return array<string, mixed> */
    private function power(mixed $raw): array
    {
        $p = is_array($raw) ? $raw : [];

        return [
            'outlets_needed' => max(0, min(64, (int) ($p['outlets_needed'] ?? 2))),
            'notes'          => $this->str($p['notes'] ?? null),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function wirelessList(mixed $raw): array
    {
        // The old MemberWirelessPrefs wrapped the list in a `units` key.
        if (is_array($raw) && ! array_is_list($raw) && isset($raw['units'])) {
            $raw = $raw['units'];
        }

        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_map(fn (array $u): array => [
            'id'             => $this->str($u['id'] ?? null) ?: $this->uid('wl'),
            'type'           => in_array($u['type'] ?? null, self::WIRELESS_TYPES, true) ? $u['type'] : 'other',
            'brand_model'    => $this->str($u['brand_model'] ?? null),
            'frequency_band' => $this->str($u['frequency_band'] ?? null),
            'own_unit'       => (bool) ($u['own_unit'] ?? false),
            'notes'          => $this->str($u['notes'] ?? null),
        ], array_filter($raw, 'is_array')));
    }

    // ── Small helpers ─────────────────────────────────────────────────────────

    private function decode(mixed $value): mixed
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || $value === '') {
            return null;
        }

        return json_decode($value, true);
    }

    private function str(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private function coord(mixed $value): float
    {
        return max(0.0, min(100.0, is_numeric($value) ? (float) $value : 0.0));
    }

    private function uid(string $prefix): string
    {
        return $prefix . '_' . bin2hex(random_bytes(6));
    }
};
