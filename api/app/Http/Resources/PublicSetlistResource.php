<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicSetlistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->items()->with('song')->orderBy('position')->get();

        $totalSec = $items->sum(fn ($item) =>
            $item->override_duration_sec ?? $item->song?->duration_sec ?? 0
        );

        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'concert_id'         => $this->concert_id,
            'items'              => $items->map(fn ($item) => [
                'id'                    => $item->id,
                'position'              => $item->position,
                'is_encore'             => (bool) $item->is_encore,
                'transition'            => $item->transition,
                'override_duration_sec' => $item->override_duration_sec,
                'song'                  => $item->song ? [
                    'id'           => $item->song->id,
                    'title'        => $item->song->title,
                    'duration_sec' => $item->song->duration_sec,
                ] : null,
            ]),
            'total_duration_sec' => $totalSec ?: null,
        ];
    }
}
