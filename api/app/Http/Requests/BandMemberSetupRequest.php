<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\SignalChainType;
use App\Http\Requests\Concerns\ValidatesRig;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BandMemberSetupRequest extends FormRequest
{
    use ValidatesRig;

    /** Ownership is enforced in the controller (members may only touch their own). */
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $creating = $this->isMethod('POST');

        return array_merge(
            // Every rig key is optional here: a PATCH-style update may send only
            // part of a rig (the "make default" button sends is_default alone),
            // and `required` would reject a legitimately empty list.
            $this->rigRules('', required: false),
            [
                'name'              => [$creating ? 'required' : 'sometimes', 'required', 'string', 'max:255'],
                'is_default'        => ['nullable', 'boolean'],
                'instrument_id'     => ['nullable', 'integer', 'exists:instruments,id'],
                'shared_monitor_id' => ['nullable', 'integer', 'exists:band_member_setups,id'],

                // Overrides the trait's `sometimes`: the column is NOT NULL, so a
                // new rig has to declare how it reaches the desk.
                'signal_chain_type' => [
                    $creating ? 'required' : 'sometimes',
                    Rule::in(SignalChainType::values()),
                ],
            ],
        );
    }
}
