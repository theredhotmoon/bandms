<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug_en'      => $this->slug_en,
            'slug_pl'      => $this->slug_pl,
            'intro'        => $this->intro,
            'content'      => $this->content,
            'image'        => $this->image,
            'published_at' => $this->published_at,
            'event_date'   => $this->event_date?->format('Y-m-d'),
            'translations' => [
                'title'   => $this->getTranslations('title'),
                'intro'   => $this->getTranslations('intro'),
                'content' => $this->getTranslations('content'),
            ],
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            // `site` is the publication name, which the Article page renders above
            // each headline and as the attribution on the pull quote. It falls
            // back to the URL's host rather than being omitted: a quote with no
            // source reads as the band quoting itself.
            'press_releases' => $this->whenLoaded('pressReleases', fn () => $this->pressReleases->map(fn ($pr) => [
                'id'    => $pr->id,
                'title' => $pr->og_title ?? $pr->url,
                'url'   => $pr->url,
                'site'  => $pr->og_site_name ?: (parse_url($pr->url, PHP_URL_HOST) ?: null),
            ])),
            'created_at'     => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
