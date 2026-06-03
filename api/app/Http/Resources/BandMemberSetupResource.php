<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'signal_chain_type' => $this->signal_chain_type,
            'inputs'            => $this->inputs   ?? [],
            'monitor'           => $this->monitor  ?? $this->defaultMonitor(),
            'backline'          => $this->backline ?? $this->defaultBackline(),
            'power'             => $this->power    ?? $this->defaultPower(),
            'wireless'          => $this->wireless ?? [],
            'foh_notes'         => $this->foh_notes ?? '',
            'created_at'        => $this->created_at,
            'updated_at'        => $this->updated_at,
        ];
    }

    private function defaultMonitor(): array
    {
        return [
            'type'                  => 'wedge',
            'config'                => 'mono',
            'mix_description'       => '',
            'iem_own_pack'          => false,
            'iem_transmitter_model' => '',
            'iem_frequency'         => '',
        ];
    }

    private function defaultBackline(): array
    {
        return [
            'needed'            => false,
            'category'          => 'other',
            'brand_preference'  => '',
            'specs'             => '',
            'notes'             => '',
        ];
    }

    private function defaultPower(): array
    {
        return ['outlets_needed' => 2, 'notes' => ''];
    }
}
