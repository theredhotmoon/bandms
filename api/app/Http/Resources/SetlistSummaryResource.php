<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SetlistSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->items;

        $totalSec = $items->sum(fn ($item) =>
            $item->override_duration_sec ?? $item->song?->duration_sec ?? 0
        );

        $concert = $this->concert;

        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'setlistfm_id'       => $this->setlistfm_id,
            'concert_id'         => $this->concert_id,
            'concert_date'       => $concert?->date?->toDateString(),
            'concert_venue'      => $concert?->venue?->name,
            'item_count'         => $items->count(),
            'total_duration_sec' => $totalSec ?: null,
            'updated_at'         => $this->updated_at,
        ];
    }
}
