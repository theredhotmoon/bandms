<?php

namespace App\Http\Controllers;

use App\Models\BandProfile;
use App\Models\ShopItem;
use App\Models\ShopItemPhoto;
use App\Http\Resources\ShopItemResource;
use App\Http\Resources\ShopItemSummaryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ShopItemController extends Controller
{
    // ── Public ──────────────────────────────────────────────────────────────

    public function index(): ResourceCollection
    {
        $items = ShopItem::with(['prices', 'photos'])
            ->where('is_available', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return ShopItemSummaryResource::collection($items);
    }

    public function show(ShopItem $shopItem): ShopItemResource
    {
        abort_if(! $shopItem->is_available, 404);
        $shopItem->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories']);
        return new ShopItemResource($shopItem);
    }

    // ── Admin CRUD ──────────────────────────────────────────────────────────

    public function adminIndex(): ResourceCollection
    {
        $items = ShopItem::with(['prices', 'photos', 'categories'])
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return ShopItemSummaryResource::collection($items);
    }

    public function store(Request $request): ShopItemResource
    {
        $data = $this->validated($request);
        $prices = $request->input('prices', []);

        $this->validatePrices($request);

        $data['profile_id'] = BandProfile::value('id') ?? 1;
        $data['slug']       = ShopItem::generateSlug($data['name']);

        $item = ShopItem::create($data);

        foreach ($prices as $price) {
            $item->prices()->create([
                'currency' => strtoupper($price['currency']),
                'amount'   => $price['amount'],
            ]);
        }

        $this->syncRelations($request, $item);

        $item->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories']);
        return new ShopItemResource($item);
    }

    public function update(Request $request, ShopItem $shopItem): ShopItemResource
    {
        $data = $this->validated($request);
        $prices = $request->input('prices', []);

        $this->validatePrices($request);

        if ($shopItem->name !== $data['name']) {
            $data['slug'] = ShopItem::generateSlug($data['name'], $shopItem->id);
        }

        DB::transaction(function () use ($shopItem, $data, $prices) {
            $shopItem->update($data);

            $shopItem->prices()->delete();
            foreach ($prices as $price) {
                $shopItem->prices()->create([
                    'currency' => strtoupper($price['currency']),
                    'amount'   => $price['amount'],
                ]);
            }
        });

        $this->syncRelations($request, $shopItem);

        $shopItem->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories']);
        return new ShopItemResource($shopItem);
    }

    public function destroy(ShopItem $shopItem): \Illuminate\Http\JsonResponse
    {
        $shopItem->load('photos');
        foreach ($shopItem->photos as $photo) {
            Storage::disk('public')->delete($photo->image);
        }
        $shopItem->delete();

        return response()->json(['message' => 'Shop item deleted']);
    }

    // ── Photos ───────────────────────────────────────────────────────────────

    public function uploadPhoto(Request $request, ShopItem $shopItem): \Illuminate\Http\JsonResponse
    {
        $request->validate(['photo' => 'required|image|max:4096']);

        $path = $request->file('photo')->store('shop-photos', 'public');
        $sort = $shopItem->photos()->max('sort_order') + 1;

        $photo = $shopItem->photos()->create([
            'image'      => $path,
            'sort_order' => $sort,
            'alt_text'   => $request->input('alt_text'),
        ]);

        return response()->json([
            'id'         => $photo->id,
            'url'        => '/storage/' . $photo->image,
            'alt_text'   => $photo->alt_text,
            'sort_order' => $photo->sort_order,
        ]);
    }

    public function deletePhoto(ShopItem $shopItem, ShopItemPhoto $photo): \Illuminate\Http\JsonResponse
    {
        abort_unless($photo->shop_item_id === $shopItem->id, 404);
        Storage::disk('public')->delete($photo->image);
        $photo->delete();

        return response()->json(['message' => 'Photo deleted']);
    }

    public function reorderPhotos(Request $request, ShopItem $shopItem): \Illuminate\Http\JsonResponse
    {
        $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);

        DB::transaction(function () use ($request, $shopItem) {
            foreach ($request->input('ids') as $order => $id) {
                $shopItem->photos()->where('id', $id)->update(['sort_order' => $order]);
            }
        });

        return response()->json(['message' => 'Reordered']);
    }

    // ── Band profile currencies ──────────────────────────────────────────────

    public function getCurrencies(): \Illuminate\Http\JsonResponse
    {
        $profile = BandProfile::first();
        return response()->json(['currencies' => $profile?->shop_currencies ?? []]);
    }

    public function updateCurrencies(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'currencies'   => 'required|array|min:1',
            'currencies.*' => 'required|string|size:3',
        ]);

        $profile = BandProfile::firstOrFail();
        $profile->update(['shop_currencies' => array_map('strtoupper', $request->input('currencies'))]);

        return response()->json(['currencies' => $profile->shop_currencies]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function validated(Request $request): array
    {
        return $request->validate([
            'name'             => 'required|string|max:255',
            'type'             => 'required|in:record,apparel,accessory,ticket,bundle,other',
            'description'      => 'nullable|string',
            'is_available'     => 'boolean',
            'is_presale'       => 'boolean',
            'presale_ships_at' => 'nullable|date',
            'stock_quantity'   => 'nullable|integer|min:0',
            'purchase_url'     => 'nullable|url|max:1000',
            'sort_order'       => 'integer|min:0',
        ]);
    }

    private function validatePrices(Request $request): void
    {
        $request->validate([
            'prices'           => 'required|array|min:1',
            'prices.*.currency'=> 'required|string|size:3',
            'prices.*.amount'  => 'required|numeric|min:0',
        ]);
    }

    private function syncRelations(Request $request, ShopItem $item): void
    {
        $item->tags()->sync($request->input('tag_ids', []));
        $item->releases()->sync($request->input('release_ids', []));
        $item->concerts()->sync($request->input('concert_ids', []));
        $item->posts()->sync($request->input('post_ids', []));
        $item->videos()->sync($request->input('video_ids', []));
        $item->categories()->sync($request->input('category_ids', []));
    }
}
