<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public shape — one locale, already resolved.
 *
 * Falls back to the other locale rather than emitting null: a half-translated
 * FAQ should show the language it has, not an empty accordion row. The Astro
 * build has no way to recover from a null here — it would render an empty
 * <h3> and the page would still be green.
 */
class FaqSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $locale = app()->getLocale();

        return [
            'id'          => $this->id,
            'module_slug' => $this->module_slug,
            'question'    => $this->translated('question', $locale),
            'answer'      => $this->translated('answer', $locale),
        ];
    }

    private function translated(string $field, string $locale): string
    {
        $values = $this->getTranslations($field);

        foreach ([$locale, 'en', 'pl'] as $candidate) {
            if (filled($values[$candidate] ?? null)) {
                return $values[$candidate];
            }
        }

        return '';
    }
}
