<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public shape — one locale, already resolved.
 *
 * Falls back down the locale's declared chain (config/locales.php) rather than
 * emitting null: a half-translated FAQ should show the language it has, not an
 * empty accordion row. The Astro build has no way to recover from a null here —
 * it would render an empty <h3> and the page would still be green.
 */
class FaqSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $locale = app()->getLocale();

        return [
            'id'          => $this->id,
            'module_slug' => $this->module_slug,
            'question'    => Locales::resolve($this->getTranslations('question'), $locale) ?? '',
            'answer'      => Locales::resolve($this->getTranslations('answer'), $locale) ?? '',
        ];
    }
}
