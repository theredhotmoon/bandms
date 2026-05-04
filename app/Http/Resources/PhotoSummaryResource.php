<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PhotoSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slug,
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
            'posts'        => $this->whenLoaded('posts', fn () => $this->posts->map(fn ($p) => [
                'id'    => $p->id,
                'title' => $p->title,
                'slug'  => $p->slug,
            ])),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
