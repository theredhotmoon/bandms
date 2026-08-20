<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class AuthorResource extends AuthorSummaryResource
{
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'social_links' => $this->whenLoaded('socialLinks', fn () => $this->socialLinks->map(fn ($l) => [
                'platform' => $l->platform,
                'url'      => $l->url,
            ])),
            'press_releases' => $this->whenLoaded('pressReleases', fn () => $this->pressReleases->map(fn ($pr) => [
                'id'       => $pr->id,
                'url'      => $pr->url,
                'og_title' => $pr->og_title,
            ])),
            'concerts' => $this->whenLoaded('concerts', fn () => $this->concerts->map(fn ($c) => [
                'id'   => $c->id,
                'date' => $c->date,
            ])),
            'tours' => $this->whenLoaded('tours', fn () => $this->tours->map(fn ($t) => [
                'id'   => $t->id,
                'name' => $t->name,
            ])),
            'photos' => $this->whenLoaded('photos', fn () => $this->photos->map(fn ($p) => [
                'id'       => $p->id,
                'filename' => $p->filename,
            ])),
        ]);
    }
}
