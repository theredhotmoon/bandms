<?php

namespace App\Http\Resources;

use App\Models\ConcertTicketType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConcertTicketTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ConcertTicketType $this */
        $activeTier = $this->activeTier();
        $soldCount  = (int) $this->soldCount();

        return [
            'id'           => $this->id,
            'concert_id'   => $this->concert_id,
            'name'          => $this->name,
            'description'   => $this->description,
            'available_from'=> $this->available_from?->toIso8601String(),
            'on_sale_until' => $this->on_sale_until?->toIso8601String(),
            'max_per_order'=> $this->max_per_order,
            'sort_order'   => $this->sort_order,
            'sold_count'   => $soldCount,
            'is_on_sale'   => $this->isOnSale(),
            'active_tier'  => $activeTier ? [
                'id'              => $activeTier->id,
                'name'            => $activeTier->name,
                'price'           => (float) $activeTier->price,
                'currency'        => $activeTier->currency,
                'available_from'  => $activeTier->available_from?->toDateString(),
                'available_until' => $activeTier->available_until?->toDateString(),
                'available_count' => $activeTier->available_count,
                'sold_count'      => (int) $activeTier->soldCount(),
                'remaining'       => $activeTier->available_count !== null
                    ? max(0, $activeTier->available_count - $activeTier->soldCount())
                    : null,
            ] : null,
            'tiers'        => $this->tiers->map(fn ($tier) => [
                'id'              => $tier->id,
                'name'            => $tier->name,
                'price'           => (float) $tier->price,
                'currency'        => $tier->currency,
                'available_from'  => $tier->available_from?->toDateString(),
                'available_until' => $tier->available_until?->toDateString(),
                'available_count' => $tier->available_count,
                'sold_count'      => (int) $tier->soldCount(),
                'sort_order'      => $tier->sort_order,
            ]),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
