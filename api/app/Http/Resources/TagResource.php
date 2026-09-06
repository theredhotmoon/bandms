<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TagResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $names = $this->getTranslations('name');

        return [
            'id'           => $this->id,
            // Resolved for the request's locale, falling back down the
            // declared chain rather than emitting an empty string — a tag
            // pill with no text is worse than one in the wrong language.
            'name'         => Locales::resolve($names, app()->getLocale()) ?? '',
            'slug_en'      => $this->slug_en,
            'slug_pl'      => $this->slug_pl,
            // Raw bag, one key per registered locale, for the admin editor.
            'translations' => [
                'name' => collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => [$code => ($names[$code] ?? null) ?: null])
                    ->all(),
            ],
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
