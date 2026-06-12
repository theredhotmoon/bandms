<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopItemVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'value'          => $this->value,
            'stock_quantity' => $this->stock_quantity,
            'sort_order'     => $this->sort_order,
        ];
    }
}
