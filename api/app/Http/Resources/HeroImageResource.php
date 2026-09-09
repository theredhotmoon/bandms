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
            'url'      => $this->image ? '/storage/' . $this->image : null,
            'caption'  => $this->caption,
            'position' => $this->position,
            'active'   => $this->active,
        ];
    }
}
