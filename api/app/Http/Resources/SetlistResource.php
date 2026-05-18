<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SetlistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->items()->with('song')->orderBy('position')->get();

        $totalSec = $items->sum(fn ($item) =>
            $item->override_duration_sec ?? $item->song?->duration_sec ?? 0
        );

        $concert = $this->concert;

        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'setlistfm_id'       => $this->setlistfm_id,
            'concert_id'         => $this->concert_id,
            'concert'            => $concert ? [
                'id'    => $concert->id,
                'date'  => $concert->date?->toDateString(),
                'venue' => $concert->venue?->name,
            ] : null,
            'foh_notes'          => $this->foh_notes ?? '',
            'lighting_notes'     => $this->lighting_notes ?? '',
            'items'              => SetlistItemResource::collection($items),
            'total_duration_sec' => $totalSec ?: null,
            'created_at'         => $this->created_at,
            'updated_at'         => $this->updated_at,
        ];
    }
}
