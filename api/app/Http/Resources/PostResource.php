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
            'slug'         => $this->slug,
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
            'links'        => PostLinkResource::collection($this->whenLoaded('links')),
            'concerts'     => $this->whenLoaded('concerts', fn () => $this->concerts->map(fn ($c) => [
                'id'    => $c->id,
                'date'  => $c->date?->format('Y-m-d'),
                'venue' => $c->venue ? ['id' => $c->venue->id, 'name' => $c->venue->name] : null,
            ])),
            'albums'       => $this->whenLoaded('albums', fn () => $this->albums->map(fn ($a) => [
                'id' => $a->id, 'title' => $a->title,
            ])),
            'releases'     => $this->whenLoaded('releases', fn () => $this->releases->map(fn ($r) => [
                'id' => $r->id, 'title' => $r->title, 'type' => $r->type,
            ])),
            'tours'          => $this->whenLoaded('tours', fn () => $this->tours->map(fn ($t) => [
                'id' => $t->id, 'name' => $t->name,
            ])),
            'music_videos'   => $this->whenLoaded('musicVideos', fn () => $this->musicVideos->map(fn ($v) => [
                'id' => $v->id, 'title' => $v->og_title ?? $v->title, 'video_url' => $v->video_url,
            ])),
            'press_releases' => $this->whenLoaded('pressReleases', fn () => $this->pressReleases->map(fn ($pr) => [
                'id' => $pr->id, 'title' => $pr->og_title ?? $pr->url, 'url' => $pr->url,
            ])),
            'created_at'     => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
