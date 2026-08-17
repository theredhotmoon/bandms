<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesRig;
use Illuminate\Foundation\Http\FormRequest;

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
            [
                'name'              => [$creating ? 'required' : 'sometimes', 'required', 'string', 'max:255'],
                'is_default'        => ['nullable', 'boolean'],
                'instrument_id'     => ['nullable', 'integer', 'exists:instruments,id'],
                'shared_monitor_id' => ['nullable', 'integer', 'exists:band_member_setups,id'],
            ],
            // A saved setup is a complete rig on create; PATCH-style updates
            // (e.g. just flipping is_default) may send only part of it.
            $this->rigRules('', required: false),
        );
    }
}
