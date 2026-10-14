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
            // The default locale's slug: the tag's stable key, which the
            // public site filters on in every language (it read slug_en).
            'slug'         => $this->slugIn(Locales::default()),
            // Raw bag, one key per registered locale, for the admin editor.
            'translations' => [
                'name' => collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => [$code => ($names[$code] ?? null) ?: null])
                    ->all(),
                'slug' => collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => [$code => $this->slugIn($code)])
                    ->all(),
            ],
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
