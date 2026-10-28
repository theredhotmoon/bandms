<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin shape — both locales, for the editor.
 *
 * The public site gets FaqSummaryResource instead, which resolves the active
 * locale server-side so the static build never ships the other language.
 */
class FaqResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $questions = $this->getTranslations('question');
        $answers   = $this->getTranslations('answer');

        return [
            'id'           => $this->id,
            'module_slug'  => $this->module_slug,
            // One key per registered locale, present even when empty: the admin
            // editor renders an input per key it receives, so an omitted locale
            // would be uneditable rather than merely blank.
            'question'     => Locales::bag($questions),
            'answer'       => Locales::bag($answers),
            'sort_order'   => $this->sort_order,
            'is_published' => (bool) $this->is_published,
            'updated_at'   => $this->updated_at,
        ];
    }
}
