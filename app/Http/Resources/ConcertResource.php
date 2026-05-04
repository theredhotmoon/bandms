<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConcertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'date'        => $this->date?->format('Y-m-d'),
            'time'        => $this->time,
            'description' => $this->description,
            'venue'       => new VenueResource($this->whenLoaded('venue')),
            'bands'       => BandResource::collection($this->whenLoaded('bands')),
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
