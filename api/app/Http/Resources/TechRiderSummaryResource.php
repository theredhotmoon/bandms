<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TechRiderSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'is_active'    => $this->is_active,
            'public_token' => $this->public_token,
            'concert_id'   => $this->concert_id,
            'updated_at'   => $this->updated_at,
        ];
    }
}
