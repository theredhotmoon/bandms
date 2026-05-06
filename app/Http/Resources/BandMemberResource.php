<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BandMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'band_id'    => $this->band_id,
            'first_name' => $this->first_name,
            'last_name'  => $this->last_name,
            'bio'        => $this->bio,
            'photo'      => $this->photo,
            'role'       => $this->role,
            'is_current' => $this->is_current,
            'joined_at'  => $this->joined_at?->format('Y-m-d'),
            'quit_at'    => $this->quit_at?->format('Y-m-d'),
            'sort_order'   => $this->sort_order,
            'social_links' => $this->socialLinks->map(fn ($l) => [
                'id'       => $l->id,
                'platform' => $l->platform,
                'url'      => $l->url,
            ]),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
