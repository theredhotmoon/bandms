<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebsiteModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $translations = $this->getTranslations('custom_name');

        return [
            'slug'         => $this->slug,
            'display_name' => $this->display_name,
            'custom_name'  => [
                'en' => $translations['en'] ?? null,
                'pl' => $translations['pl'] ?? null,
            ],
            'per_page'     => $this->per_page,
            'enabled'      => (bool) $this->enabled,
            'sort_order'   => $this->sort_order,
            'updated_at'   => $this->updated_at,
        ];
    }
}
