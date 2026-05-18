<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SongResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'duration_sec' => $this->duration_sec,
            'bpm'          => $this->bpm,
            'key'          => $this->key,
            'notes'        => $this->notes ?? '',
            'updated_at'   => $this->updated_at,
        ];
    }
}
