<?php

namespace App\Http\Controllers;

use App\Http\Resources\ShopItemVariantResource;
use App\Models\ShopItem;
use App\Models\ShopItemVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class ShopItemVariantController extends Controller
{
    public function index(ShopItem $shopItem): ResourceCollection
    {
        return ShopItemVariantResource::collection(
            $shopItem->variants()->orderBy('sort_order')->get()
        );
    }

    public function store(Request $request, ShopItem $shopItem): ShopItemVariantResource
    {
        $data = $request->validate([
            'name'           => 'required|string|max:100',
            'value'          => 'required|string|max:100',
            'stock_quantity' => 'nullable|integer|min:0',
            'sort_order'     => 'integer|min:0',
        ]);

        $variant = $shopItem->variants()->create($data);

        return new ShopItemVariantResource($variant);
    }

    public function update(Request $request, ShopItem $shopItem, ShopItemVariant $variant): ShopItemVariantResource
    {
        abort_unless($variant->shop_item_id === $shopItem->id, 404);

        $data = $request->validate([
            'name'           => 'required|string|max:100',
            'value'          => 'required|string|max:100',
            'stock_quantity' => 'nullable|integer|min:0',
            'sort_order'     => 'integer|min:0',
        ]);

        $variant->update($data);

        return new ShopItemVariantResource($variant);
    }

    public function destroy(ShopItem $shopItem, ShopItemVariant $variant): \Illuminate\Http\JsonResponse
    {
        abort_unless($variant->shop_item_id === $shopItem->id, 404);

        $variant->delete();

        return response()->json(['message' => 'Variant deleted']);
    }
}
