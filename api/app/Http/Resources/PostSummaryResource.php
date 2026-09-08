<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PostSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // content is gone; the excerpt now comes from the first text block, and
        // falls back to intro. It feeds <meta description> and the JSON-LD on
        // both article routes, so it cannot simply be dropped.
        $firstText = $this->relationLoaded('blocks')
            ? $this->blocks->firstWhere('type', 'text')
            : null;

        $body = $firstText
            ? ($firstText->payload['body'][app()->getLocale()] ?? $firstText->payload['body']['en'] ?? '')
            : '';

        $excerpt = Str::limit(strip_tags($body) ?: (string) $this->intro, 280);

        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug_en'      => $this->slug_en,
            'slug_pl'      => $this->slug_pl,
            'intro'        => $this->intro,
            'excerpt'      => $excerpt,
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
