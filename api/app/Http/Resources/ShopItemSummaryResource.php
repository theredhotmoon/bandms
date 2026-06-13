<?php

namespace App\Http\Resources;

use App\Http\Resources\ShopItemVariantResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopItemSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'slug'             => $this->slug,
            'type'             => $this->type,
            'is_available'     => $this->is_available,
            'is_presale'       => $this->is_presale,
            'presale_ships_at' => $this->presale_ships_at?->format('Y-m-d'),
            'stock_quantity'   => $this->stock_quantity,
            'purchase_url'     => $this->purchase_url,
            'sort_order'       => $this->sort_order,
            'prices'           => $this->prices->map(fn ($p) => [
                'currency' => $p->currency,
                'amount'   => (float) $p->amount,
            ])->values(),
            'cover_photo'      => ($first = $this->photos->first())
                ? '/storage/' . $first->image
                : null,
            'categories'       => $this->categories->map(fn ($c) => [
                'id'   => $c->id,
                'name' => $c->name,
            ])->values(),
            'variants'         => ShopItemVariantResource::collection($this->whenLoaded('variants')),
            'created_at'       => $this->created_at,
            'updated_at'       => $this->updated_at,
        ];
    }
}
