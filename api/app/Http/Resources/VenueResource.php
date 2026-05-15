<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VenueResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'street'          => $this->street,
            'street_number'   => $this->street_number,
            'city'            => $this->city,
            'postcode'        => $this->postcode,
            'additional_info' => $this->additional_info,
            'latitude'        => $this->latitude,
            'longitude'       => $this->longitude,
            'tags'            => TagResource::collection($this->whenLoaded('tags')),
            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
        ];
    }
}
