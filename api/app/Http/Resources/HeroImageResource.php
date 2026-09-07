<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HeroImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->id,
            'photo_id' => $this->photo_id,
            // Mirrors PhotoResource::image_url so the admin can render the same
            // thumbnail it shows in the gallery.
            'url'      => $this->photo?->image ? '/storage/' . $this->photo->image : null,
            'caption'  => $this->photo?->caption,
            'position' => $this->position,
        ];
    }
}
