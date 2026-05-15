<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class PressReleaseResource extends PressReleaseSummaryResource
{
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'concerts' => $this->whenLoaded('concerts', fn () => $this->concerts->map(fn ($c) => [
                'id'   => $c->id,
                'date' => $c->date,
            ])),
            'posts'    => $this->whenLoaded('posts', fn () => $this->posts->map(fn ($p) => [
                'id'    => $p->id,
                'title' => $p->title,
                'slug'  => $p->slug,
            ])),
            'albums'   => $this->whenLoaded('albums', fn () => $this->albums->map(fn ($a) => [
                'id'    => $a->id,
                'title' => $a->title,
            ])),
            'releases' => $this->whenLoaded('releases', fn () => $this->releases->map(fn ($r) => [
                'id'    => $r->id,
                'title' => $r->title,
                'type'  => $r->type,
            ])),
            'tours'    => $this->whenLoaded('tours', fn () => $this->tours->map(fn ($t) => [
                'id'   => $t->id,
                'name' => $t->name,
            ])),
        ]);
    }
}
