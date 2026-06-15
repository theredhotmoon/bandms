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
            'profile_id'   => $this->profile_id,
            'title'        => $this->title,
            'type'         => $this->type,
            'release_date' => $this->release_date?->format('Y-m-d'),
            'cover_image'  => $this->cover_image ? '/storage/' . $this->cover_image : null,
            'description'  => $this->description,
            'is_upcoming'  => (bool) $this->is_upcoming,
            'presave_url'  => $this->presave_url,
            'label_name'   => $this->label_name,
            'translations' => [
                'title'       => $this->getTranslations('title'),
                'description' => $this->getTranslations('description'),
            ],
            'links'        => $this->whenLoaded('links', fn () => $this->links->map(fn ($l) => [
                'id'       => $l->id,
                'platform' => $l->platform,
                'url'      => $l->url,
            ])),
            'tracks'       => $this->whenLoaded('tracks', fn () => $this->tracks->map(fn ($t) => [
                'id'              => $t->id,
                'title'           => $t->title,
                'duration'        => $t->duration,
                'lyrics'          => $t->lyrics,
                'sort_order'      => $t->sort_order,
                'bpm'             => $t->bpm,
                'musical_key'     => $t->musical_key,
                'mood_tags'       => $t->mood_tags,
                'isrc'            => $t->isrc,
                'explicit'        => (bool) $t->explicit,
                'stems_available' => (bool) $t->stems_available,
                'sync_placements' => $t->sync_placements,
                'links'           => $t->links->map(fn ($l) => [
                    'id'       => $l->id,
                    'platform' => $l->platform,
                    'url'      => $l->url,
                ])->values(),
            ])),
            'photos'       => $this->whenLoaded('photos', fn () => $this->photos->map(fn ($p) => [
                'id'         => $p->id,
                'image_url'  => '/storage/' . $p->image,
                'sort_order' => $p->sort_order,
                'caption'    => $p->caption,
            ])),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
