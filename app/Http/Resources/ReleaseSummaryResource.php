<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReleaseSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'band_id'      => $this->band_id,
            'band_name'    => $this->band?->name,
            'title'        => $this->title,
            'type'         => $this->type,
            'release_date' => $this->release_date?->format('Y-m-d'),
            'cover_image'  => $this->cover_image,
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
