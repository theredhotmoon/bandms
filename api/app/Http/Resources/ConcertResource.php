<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ConcertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->getTranslation('name', 'en'),
            // The default locale's slug — every concert URL, in every language,
            // is built from it. The concert-{id} fallback is the URL a concert
            // without a slug has always been served at; the migration stored
            // it for those rows, and this keeps it for any created without one.
            'slug'           => $this->slugIn(Locales::default()) ?? 'concert-' . $this->id,
            'date'           => $this->date?->format('Y-m-d'),
            'doors_open'       => $this->doors_open,
            'sound_check_time' => $this->sound_check_time,
            'start_time'       => $this->start_time,
            'own_sort_order' => $this->own_sort_order,
            'description'    => $this->getTranslation('description', 'en'),
            'translations'   => [
                'name'        => $this->getTranslations('name'),
                'description' => $this->getTranslations('description'),
                'slug'        => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $this->slugIn($c)])->all(),
            ],
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
            'member_ids' => $this->whenLoaded('members', fn () => $this->members->pluck('id')->values()),
            'links' => $this->whenLoaded('links', fn () =>
                $this->links->map(fn ($l) => [
                    'id'    => $l->id,
                    'label' => $l->label,
                    'url'   => $l->url,
                ])
            ),
            'clips' => ClipResource::collection($this->whenLoaded('clips')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
