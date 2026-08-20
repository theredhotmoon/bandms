<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PostSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $content = $this->getTranslation('content', app()->getLocale(), false) ?? '';

        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug_en'      => $this->slug_en,
            'slug_pl'      => $this->slug_pl,
            'intro'        => $this->intro,
            'excerpt'      => Str::limit($content, 280),
            'published_at' => $this->published_at,
            'event_date'   => $this->event_date?->format('Y-m-d'),
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'translations' => [
                'title' => $this->getTranslations('title'),
                'intro' => $this->getTranslations('intro'),
            ],
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
