<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BandLogoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'url'           => $this->url,
            'original_name' => $this->original_name,
            'mime_type'     => $this->mime_type,
            'file_size'     => $this->file_size,
            'width'         => $this->width,
            'height'        => $this->height,
            'is_vector'     => $this->is_vector,
            'label'         => $this->label,
            'variant'       => $this->variant,
            'background'    => $this->background,
            'is_default'    => $this->is_default,
            'is_deprecated' => $this->is_deprecated,
            'version_label' => $this->version_label,
            'notes'         => $this->notes,
            'sort_order'    => $this->sort_order,
            'created_at'    => $this->created_at,
            'updated_at'    => $this->updated_at,
        ];
    }
}
