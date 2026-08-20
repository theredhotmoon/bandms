<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesRig;
use Illuminate\Foundation\Http\FormRequest;

class TechRiderRequest extends FormRequest
{
    use ValidatesRig;

    /** Route access is already gated by auth:api + role middleware. */
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $creating = $this->isMethod('POST');

        return array_merge(
            [
                'name'       => [$creating ? 'required' : 'sometimes', 'required', 'string', 'max:255'],
                'is_active'  => ['boolean'],
                'concert_id' => ['nullable', 'integer', 'exists:concerts,id'],

                // ── Who is playing ────────────────────────────────────────────
                'gig_lineup'                              => ['nullable', 'array'],
                'gig_lineup.regular_members'              => ['sometimes', 'array'],
                'gig_lineup.regular_members.*.band_member_id' => ['required', 'integer', 'exists:band_members,id'],
                'gig_lineup.regular_members.*.is_available'   => ['required', 'boolean'],
                'gig_lineup.temp_musicians'               => ['sometimes', 'array'],
                'gig_lineup.temp_musicians.*.id'          => ['required', 'string', 'max:64'],
                'gig_lineup.temp_musicians.*.name'        => ['required', 'string', 'max:255'],
                'gig_lineup.temp_musicians.*.role'        => ['present', 'nullable', 'string', 'max:255'],

                // ── Placements: the single source of truth ────────────────────
                'placements'                   => ['nullable', 'array', 'max:64'],
                'placements.*.id'              => ['required', 'string', 'max:64'],
                'placements.*.band_member_id'  => ['present', 'nullable', 'integer', 'exists:band_members,id'],
                'placements.*.temp_id'         => ['nullable', 'string', 'max:64'],
                'placements.*.setup_id'        => ['present', 'nullable', 'integer', 'exists:band_member_setups,id'],
                'placements.*.x'               => ['required', 'numeric', 'min:0', 'max:100'],
                'placements.*.y'               => ['required', 'numeric', 'min:0', 'max:100'],
                'placements.*.instruments'     => ['present', 'array', 'max:8'],
                // A placement's override is sparse by design: absent keys mean
                // "inherit from the referenced setup".
                'placements.*.overrides'       => ['present', 'array'],

                // ── Production-level extras (belong to no musician) ───────────
                'channel_order'   => ['nullable', 'array', 'max:256'],
                'channel_order.*' => ['string', 'max:160'],

                // `sometimes` throughout: these objects are optional on a partial
                // update, and an implicit rule (`required` / `present`) on a
                // nested key fires even when its parent was not sent at all.
                'power_notes'                     => ['nullable', 'array'],
                'power_notes.total_wattage'       => ['nullable', 'integer', 'min:0', 'max:1000000'],
                'power_notes.needs_clean_power'   => ['sometimes', 'boolean'],
                'power_notes.general_notes'       => ['sometimes', 'nullable', 'string', 'max:2000'],

                'pa_foh'                          => ['nullable', 'array'],
                'pa_foh.room_coverage_notes'      => ['sometimes', 'nullable', 'string', 'max:2000'],
                'pa_foh.subwoofer_notes'          => ['sometimes', 'nullable', 'string', 'max:2000'],
                'pa_foh.processing_notes'         => ['sometimes', 'nullable', 'string', 'max:2000'],
                'pa_foh.console_preference'       => ['sometimes', 'nullable', 'string', 'max:255'],
                'pa_foh.brings_own_foh_engineer'  => ['sometimes', 'boolean'],
                'pa_foh.foh_engineer_name'        => ['sometimes', 'nullable', 'string', 'max:255'],
                'pa_foh.brings_show_file'         => ['sometimes', 'boolean'],
                'pa_foh.show_file_format'         => ['sometimes', 'nullable', 'string', 'max:255'],
            ],
            $this->placedInstrumentRules('placements.*.instruments.*'),
            // Overrides are sparse, so every rig key is optional here.
            $this->rigRules('placements.*.overrides', required: false),
            // Extras reuse the rig vocabulary one list at a time.
            $this->extraListRules(),
        );
    }

    /** @return array<string, mixed> */
    private function extraListRules(): array
    {
        $rig = $this->rigRules('__x', required: false);

        // Reuse the per-item rules from the rig trait, rebased onto the
        // extra_* keys, so an extra channel is validated exactly like a
        // musician's channel rather than by a second copy of the rules.
        $rebase = function (string $from, string $to) use ($rig): array {
            $out = [];
            foreach ($rig as $key => $rules) {
                if (str_starts_with($key, "__x.{$from}.")) {
                    $out[$to . substr($key, strlen("__x.{$from}"))] = $rules;
                }
            }

            return $out;
        };

        return array_merge(
            ['extra_inputs'   => ['nullable', 'array', 'max:64']],
            $rebase('inputs', 'extra_inputs'),
            ['extra_monitors' => ['nullable', 'array', 'max:32']],
            $rebase('monitors', 'extra_monitors'),
            ['extra_backline' => ['nullable', 'array', 'max:32']],
            $rebase('backline', 'extra_backline'),
            ['extra_wireless' => ['nullable', 'array', 'max:32']],
            $rebase('wireless', 'extra_wireless'),
        );
    }
}
