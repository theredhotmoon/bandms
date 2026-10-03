<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AlbumResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $photos = $this->whenLoaded('photos');

        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slugIn(Locales::default()),
            'translations' => [
                'slug' => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $this->slugIn($c)])->all(),
            ],
            'description'  => $this->description,
            'taken_at'     => $this->taken_at,
            'published_at' => $this->published_at,
            'venue'        => $this->whenLoaded('venue', fn () => $this->venue
                ? ['id' => $this->venue->id, 'name' => $this->venue->name]
                : null),
            'concert'      => $this->whenLoaded('concert', fn () => $this->concert
                ? ['id' => $this->concert->id, 'date' => $this->concert->date?->format('Y-m-d'), 'description' => $this->concert->description]
                : null),
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'photos'       => $this->whenLoaded('photos', fn () => $this->photos->map(fn ($p) => [
                'id'           => $p->id,
                'image_url'    => $p->image ? '/storage/' . $p->image : null,
                'sort_order'   => $p->sort_order,
                'caption'      => $p->caption,
                'epk_featured' => (bool) $p->epk_featured,
                // Who is in it, for the admin's tag picker. Absent unless the
                // query loaded photos.members.
                'member_ids'   => $p->relationLoaded('members') ? $p->members->pluck('id')->values() : null,
            ])),
            'photo_count'  => $this->when($photos !== null, fn () => $photos->count(), fn () => $this->photos()->count()),
            'cover_url'    => $this->whenLoaded('photos', fn () =>
                $this->photos->first()?->image ? '/storage/' . $this->photos->first()->image : null
            ),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
