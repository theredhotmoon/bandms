<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReleaseResource extends JsonResource
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
            'description'  => $this->description,
            'links'        => $this->whenLoaded('links', fn () => $this->links->map(fn ($l) => [
                'id'       => $l->id,
                'platform' => $l->platform,
                'url'      => $l->url,
            ])),
            'tracks'       => $this->whenLoaded('tracks', fn () => $this->tracks->map(fn ($t) => [
                'id'         => $t->id,
                'title'      => $t->title,
                'duration'   => $t->duration,
                'lyrics'     => $t->lyrics,
                'sort_order' => $t->sort_order,
            ])),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
