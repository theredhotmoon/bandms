<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InstrumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $names = $this->getTranslations('name');

        return [
            'id'              => $this->id,
            // Resolved for the request's locale, falling back down the
            // declared chain rather than emitting an empty string.
            'name'            => Locales::resolve($names, app()->getLocale()) ?? '',
            'category'        => $this->category,
            'stage_plot_type' => $this->stage_plot_type,
            // Raw bag, one key per registered locale, for the admin editor.
            'translations'    => [
                // `?? null`, not `?: null` — a legitimately-saved "0" is
                // filled() and must survive round to the admin editor rather
                // than reading as cleared.
                'name' => collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => [$code => $names[$code] ?? null])
                    ->all(),
            ],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
