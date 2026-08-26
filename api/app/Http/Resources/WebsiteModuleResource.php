<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebsiteModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $translations = $this->getTranslations('custom_name');
        $slugs        = $this->getTranslations('custom_slug');

        return [
            'slug'         => $this->slug,
            'display_name' => $this->display_name,
            'custom_name'  => [
                'en' => ($translations['en'] ?? null) ?: null,
                'pl' => ($translations['pl'] ?? null) ?: null,
            ],
            // Empty means "fall back to the module key" — the admin renders the
            // key as the input's placeholder to make that visible.
            'custom_slug'  => [
                'en' => ($slugs['en'] ?? null) ?: null,
                'pl' => ($slugs['pl'] ?? null) ?: null,
            ],
            'per_page'     => $this->per_page,
            'enabled'      => (bool) $this->enabled,
            'sort_order'   => $this->sort_order,
            'updated_at'   => $this->updated_at,
        ];
    }
}
