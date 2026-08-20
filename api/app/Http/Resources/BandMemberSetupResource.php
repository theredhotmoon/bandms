<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A saved rig. The keys below the identity fields are the shared "rig" shape —
 * a rider placement's override uses exactly the same vocabulary, so anything
 * added here must be added to App\Http\Requests\Concerns\ValidatesRig too.
 */
class BandMemberSetupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'band_member_id'    => $this->band_member_id,
            'instrument_id'     => $this->instrument_id,
            'shared_monitor_id' => $this->shared_monitor_id,
            'name'              => $this->name,
            'is_default'        => (bool) $this->is_default,

            // ── Rig ───────────────────────────────────────────────────────────
            'signal_chain_type' => $this->signal_chain_type,
            'inputs'            => $this->inputs    ?? [],
            'monitors'          => $this->monitors  ?? [],
            'backline'          => $this->backline  ?? [],
            'power'             => [
                'outlets_needed' => $this->power['outlets_needed'] ?? 2,
                'notes'          => $this->power['notes']          ?? '',
            ],
            'wireless'          => $this->wireless  ?? [],
            'foh_notes'         => $this->foh_notes ?? '',

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
