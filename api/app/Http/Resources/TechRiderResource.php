<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TechRiderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'profile_id'      => $this->profile_id,
            'name'            => $this->name,
            'is_active'       => $this->is_active,
            'public_token'    => $this->public_token,
            'concert_id'      => $this->concert_id,
            'concert'         => $this->whenLoaded('concert', fn () => $this->concert ? [
                'id'    => $this->concert->id,
                'date'  => $this->concert->date,
                'venue' => $this->concert->venue?->name,
            ] : null),
            'gig_lineup'      => $this->gig_lineup      ?? (object)[],
            'stage_plot_data' => $this->stage_plot_data ?? [],
            'inputs'          => $this->inputs          ?? [],
            'monitors'        => $this->monitors        ?? [],
            'backline'        => $this->backline        ?? [],
            'pa_foh'          => $this->pa_foh          ?? (object)[],
            'power'           => $this->power           ?? (object)[],
            'rf_wireless'     => $this->rf_wireless     ?? [],
            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
        ];
    }
}
