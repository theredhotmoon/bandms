<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PressReleaseSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'profile_id'     => $this->profile_id,
            'url'            => $this->url,
            'og_title'       => $this->og_title,
            'og_description' => $this->og_description,
            'og_image'       => $this->og_image,
            'og_site_name'   => $this->og_site_name,
            'published_at'   => $this->published_at?->toIso8601String(),
            'featured'        => (bool) $this->featured,
            'tags'            => $this->whenLoaded('tags', fn () => $this->tags->map(fn ($t) => [
                'id'   => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
            ])),
            'concerts_count'  => $this->concerts_count ?? 0,
            'posts_count'     => $this->posts_count ?? 0,
            'albums_count'    => $this->albums_count ?? 0,
            'releases_count'  => $this->releases_count ?? 0,
            'tours_count'     => $this->tours_count ?? 0,
            'authors_count'   => $this->authors_count ?? 0,
            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
        ];
    }
}
