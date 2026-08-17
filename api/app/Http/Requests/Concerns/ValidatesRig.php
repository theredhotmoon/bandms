<?php

declare(strict_types=1);

namespace App\Http\Requests\Concerns;

use App\Enums\SignalChainType;
use App\Enums\StagePlotType;
use Illuminate\Validation\Rule;

/**
 * Validation rules for a "rig" — the technical requirements of one musician.
 *
 * A saved band_member_setups row is a complete rig; a rider placement carries a
 * sparse override of the same shape. Both validate through here so the two can
 * never disagree about what a rig looks like, which is exactly how the previous
 * `['nullable', 'array']` catch-all let malformed sections reach the database.
 */
trait ValidatesRig
{
    /**
     * @param  string  $prefix    '' for a top-level rig, or e.g. 'placements.*.overrides'
     * @param  bool    $required  true when every key must be present (a full rig)
     * @return array<string, mixed>
     */
    protected function rigRules(string $prefix = '', bool $required = false): array
    {
        $p        = $prefix === '' ? '' : rtrim($prefix, '.') . '.';
        $presence = $required ? 'required' : 'sometimes';

        return [
            "{$p}signal_chain_type" => [$presence, Rule::in(SignalChainType::values())],
            "{$p}foh_notes"         => [$presence, 'nullable', 'string', 'max:5000'],

            // ── Inputs ────────────────────────────────────────────────────────
            // No `channel` key: channel numbers are assigned when the rider is
            // resolved, so a stored one could only ever be a stale duplicate.
            "{$p}inputs"              => [$presence, 'array', 'max:128'],
            "{$p}inputs.*.id"         => ['required', 'string', 'max:64'],
            "{$p}inputs.*.instrument" => ['required', 'string', 'max:255'],
            "{$p}inputs.*.mic_di"     => ['required', Rule::in(['Mic', 'DI', 'Mic+DI'])],
            "{$p}inputs.*.mic_model"  => ['present', 'nullable', 'string', 'max:255'],
            "{$p}inputs.*.stand_type" => ['present', 'nullable', 'string', 'max:255'],
            "{$p}inputs.*.notes"      => ['present', 'nullable', 'string', 'max:1000'],

            // ── Monitors ──────────────────────────────────────────────────────
            "{$p}monitors"                          => [$presence, 'array', 'max:32'],
            "{$p}monitors.*.id"                     => ['required', 'string', 'max:64'],
            "{$p}monitors.*.label"                  => ['present', 'nullable', 'string', 'max:255'],
            "{$p}monitors.*.type"                   => ['required', Rule::in(['wedge', 'iem'])],
            "{$p}monitors.*.config"                 => ['required', Rule::in(['mono', 'stereo'])],
            "{$p}monitors.*.mix_description"        => ['present', 'nullable', 'string', 'max:1000'],
            "{$p}monitors.*.iem_own_pack"           => ['boolean'],
            "{$p}monitors.*.iem_transmitter_model"  => ['present', 'nullable', 'string', 'max:255'],
            "{$p}monitors.*.iem_frequency"          => ['present', 'nullable', 'string', 'max:255'],

            // ── Backline ──────────────────────────────────────────────────────
            "{$p}backline"                    => [$presence, 'array', 'max:32'],
            "{$p}backline.*.id"               => ['required', 'string', 'max:64'],
            "{$p}backline.*.needed"           => ['boolean'],
            "{$p}backline.*.category"         => ['required', Rule::in(['drum_kit', 'guitar_amp', 'bass_amp', 'keyboard', 'other'])],
            "{$p}backline.*.name"             => ['present', 'nullable', 'string', 'max:255'],
            "{$p}backline.*.brand_preference" => ['present', 'nullable', 'string', 'max:255'],
            "{$p}backline.*.specs"            => ['present', 'nullable', 'string', 'max:1000'],
            "{$p}backline.*.notes"            => ['present', 'nullable', 'string', 'max:1000'],

            // ── Power ─────────────────────────────────────────────────────────
            // `sometimes`, not `required`: `power` itself is optional, and an
            // implicit rule on a nested key fires even when its parent is absent
            // — which would reject every partial update.
            "{$p}power"                => [$presence, 'array'],
            "{$p}power.outlets_needed" => ['sometimes', 'integer', 'min:0', 'max:64'],
            "{$p}power.notes"          => ['sometimes', 'nullable', 'string', 'max:1000'],

            // ── Wireless ──────────────────────────────────────────────────────
            "{$p}wireless"                  => [$presence, 'array', 'max:32'],
            "{$p}wireless.*.id"             => ['required', 'string', 'max:64'],
            "{$p}wireless.*.type"           => ['required', Rule::in(['instrument', 'vocal', 'iem', 'other'])],
            "{$p}wireless.*.brand_model"    => ['present', 'nullable', 'string', 'max:255'],
            "{$p}wireless.*.frequency_band" => ['present', 'nullable', 'string', 'max:255'],
            "{$p}wireless.*.own_unit"       => ['boolean'],
            "{$p}wireless.*.notes"          => ['present', 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Rules for the visual instrument slots on a placement.
     *
     * @return array<string, mixed>
     */
    protected function placedInstrumentRules(string $prefix): array
    {
        $p = rtrim($prefix, '.') . '.';

        return [
            "{$p}id"       => ['required', 'string', 'max:64'],
            "{$p}type"     => ['required', Rule::in(array_column(StagePlotType::cases(), 'value'))],
            "{$p}label"    => ['present', 'nullable', 'string', 'max:255'],
            "{$p}setup_id" => ['nullable', 'integer', 'exists:band_member_setups,id'],
        ];
    }
}
