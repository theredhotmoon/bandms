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
            'image'        => $this->image,
            'published_at' => $this->published_at,
            'event_dates'  => $this->whenLoaded('concerts', fn () => $this->sortedConcerts()
                ->map(fn ($c) => $c->date->format('Y-m-d'))),
            'event_date_display' => $this->event_date_display,
            'concerts' => $this->whenLoaded('concerts', fn () => $this->sortedConcerts()->map(fn ($c) => [
                'id'   => $c->id,
                'date' => $c->date->format('Y-m-d'),
            ])),
            'translations' => [
                'title'   => $this->getTranslations('title'),
                'intro'   => $this->getTranslations('intro'),
            ],
            // resolve() is batched deliberately (one query per ref entity type,
            // not per block) — it must be called once for the whole post, not
            // once per block inside each(), or the batching is defeated.
            'blocks' => $this->whenLoaded('blocks', function () {
                $resolved = \App\Support\PostBlockResolver::resolve($this->blocks);

                return PostBlockResource::collection($this->blocks)
                    ->each(fn ($r) => $r->withResolved($resolved));
            }),
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
