<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TourResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'description' => $this->description,
            'start_date'  => $this->start_date?->format('Y-m-d'),
            'end_date'    => $this->end_date?->format('Y-m-d'),
            'poster'      => $this->poster,
            'images'      => $this->whenLoaded('images', fn () => $this->images->map(fn ($img) => [
                'id'         => $img->id,
                'url'        => $img->url,
                'caption'    => $img->caption,
                'sort_order' => $img->sort_order,
            ])),
            'links'       => $this->whenLoaded('links', fn () => $this->links->map(fn ($l) => [
                'id'    => $l->id,
                'label' => $l->label,
                'url'   => $l->url,
            ])),
            'concerts'    => $this->whenLoaded('concerts', fn () => $this->concerts->map(fn ($c) => [
                'id'         => $c->id,
                'date'       => $c->date?->format('Y-m-d'),
                'time'       => $c->time,
                'venue_name' => $c->venue?->name,
            ])),
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
