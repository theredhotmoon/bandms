<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ConcertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'date'           => $this->date?->format('Y-m-d'),
            'doors_open'       => $this->doors_open,
            'sound_check_time' => $this->sound_check_time,
            'start_time'       => $this->start_time,
            'own_sort_order' => $this->own_sort_order,
            'description'    => $this->description,
            'poster_url'     => $this->poster ? '/storage/' . $this->poster : null,
            'venue'          => new VenueResource($this->whenLoaded('venue')),
            'bands'          => $this->whenLoaded('bands', fn () =>
                $this->bands->map(fn ($b) => [
                    'id'         => $b->id,
                    'name'       => $b->name,
                    'website'    => $b->website,
                    'sort_order' => $b->pivot->sort_order,
                    'play_time'  => $b->pivot->play_time,
                ])
            ),
            'tags'  => TagResource::collection($this->whenLoaded('tags')),
            'links' => $this->whenLoaded('links', fn () =>
                $this->links->map(fn ($l) => [
                    'id'    => $l->id,
                    'label' => $l->label,
                    'url'   => $l->url,
                ])
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
