<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'album_id'   => $this->album_id,
            'image_url'  => $this->image ? '/storage/' . $this->image : null,
            'sort_order' => $this->sort_order,
            'caption'      => $this->caption,
            'epk_featured' => (bool) $this->epk_featured,
            'created_at'   => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
