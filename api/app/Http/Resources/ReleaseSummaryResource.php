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
            'profile_id'   => $this->profile_id,
            'title'        => $this->title,
            'type'         => $this->type,
            'release_date' => $this->release_date?->format('Y-m-d'),
            'cover_image'  => $this->cover_image ? '/storage/' . $this->cover_image : null,
            'is_upcoming'  => (bool) $this->is_upcoming,
            'presave_url'  => $this->presave_url,
            'links'        => $this->whenLoaded('links', fn () => $this->links->map(fn ($l) => [
                'id'       => $l->id,
                'platform' => $l->platform,
                'url'      => $l->url,
            ])),
            'translations' => [
                'title' => $this->getTranslations('title'),
            ],
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
