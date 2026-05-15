<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BandMemberSetupSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'band_member_id'    => $this->band_member_id,
            'instrument_id'     => $this->instrument_id,
            'name'              => $this->name,
            'signal_chain_type' => $this->signal_chain_type,
            'input_count'       => count($this->inputs ?? []),
            'updated_at'        => $this->updated_at,
        ];
    }
}
