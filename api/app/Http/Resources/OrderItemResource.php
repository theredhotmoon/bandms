<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'shop_item_id'          => $this->shop_item_id,
            'shop_item_variant_id'  => $this->shop_item_variant_id,
            'name'                  => $this->name,
            'variant_label'         => $this->variant_label,
            'price'                 => (float) $this->price,
            'currency'              => $this->currency,
            'quantity'              => $this->quantity,
        ];
    }
}
