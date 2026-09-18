<?php

namespace App\Http\Resources;

use App\Support\EmbedProvider;
use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One clip. `owners` is only populated when the four owner relations are
 * loaded — ClipController loads them; owners embedded on a concert response
 * do not need them and get an empty list.
 */
class ClipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'provider'     => $this->provider,
            'url'          => $this->url,
            'embed_id'     => EmbedProvider::embedId($this->url),
            'title'        => Locales::resolve($this->getTranslations('title'), app()->getLocale()),
            'category'     => $this->category,
            'recorded_on'  => $this->recorded_on?->format('Y-m-d'),
            'show_in_epk'  => (bool) $this->show_in_epk,
            'translations' => ['title' => $this->getTranslations('title')],
            'owners'       => $this->relationLoaded('concerts') ? $this->ownersList() : [],
        ];
    }
}
