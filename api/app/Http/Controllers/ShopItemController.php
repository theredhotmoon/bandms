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
use Illuminate\Validation\Rule;
use App\Support\SiteRebuild;
use Illuminate\Support\Arr;
use App\Support\Locales;

class ShopItemController extends Controller
{
    // ── Public ──────────────────────────────────────────────────────────────

    public function index(): ResourceCollection
    {
        $items = ShopItem::with(['prices', 'photos', 'categories', 'variants'])
            ->where('is_available', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return ShopItemSummaryResource::collection($items);
    }

    public function show(ShopItem $shopItem): ShopItemResource
    {
        abort_if(! $shopItem->is_available, 404);
        $shopItem->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories', 'variants', 'clips']);
        return new ShopItemResource($shopItem);
    }

    public function showBySlug(string $slug): ShopItemResource
    {
        $shopItem = ShopItem::whereSlug($slug)->firstOrFail();
        abort_if(! $shopItem->is_available, 404);
        $shopItem->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories', 'variants', 'clips']);
        return new ShopItemResource($shopItem);
    }

    // ── Admin CRUD ──────────────────────────────────────────────────────────

    public function adminIndex(): ResourceCollection
    {
        $items = ShopItem::with(['prices', 'photos', 'categories', 'variants'])
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

        $item = new ShopItem(Arr::except($data, ['slug']));
        $item->applySlugBag($data['slug'] ?? null, $data['name']);
        $item->save();

        foreach ($prices as $price) {
            $item->prices()->create([
                'currency' => strtoupper($price['currency']),
                'amount'   => $price['amount'],
            ]);
        }

        $this->syncRelations($request, $item);
        SiteRebuild::markDirty('shop');

        $item->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories', 'clips']);
        return new ShopItemResource($item);
    }

    public function update(Request $request, ShopItem $shopItem): ShopItemResource
    {
        $data = $this->validated($request, $shopItem->id);
        $prices = $request->input('prices', []);

        $this->validatePrices($request);

        // Renaming an item with no explicit default-locale slug re-slugs it —
        // the behaviour this endpoint has always had, kept as-is: changing
        // when a public merch URL moves is not this refactor's call. Forgetting
        // the slug lets applySlugBag() generate it from the new name.
        $given = $data['slug'] ?? [];
        $shopItem->fill(Arr::except($data, ['slug']));
        if ($shopItem->isDirty('name') && blank($given[Locales::default()] ?? null)) {
            $shopItem->forgetTranslation('slug', Locales::default());
        }
        $shopItem->applySlugBag($given, $shopItem->name);

        DB::transaction(function () use ($shopItem, $prices) {
            $shopItem->save();

            $shopItem->prices()->delete();
            foreach ($prices as $price) {
                $shopItem->prices()->create([
                    'currency' => strtoupper($price['currency']),
                    'amount'   => $price['amount'],
                ]);
            }
        });

        $this->syncRelations($request, $shopItem);
        SiteRebuild::markDirty('shop');

        $shopItem->load(['prices', 'photos', 'tags', 'releases', 'concerts', 'posts', 'videos', 'categories', 'clips']);
        return new ShopItemResource($shopItem);
    }

    public function destroy(ShopItem $shopItem): \Illuminate\Http\JsonResponse
    {
        $shopItem->load('photos');
        foreach ($shopItem->photos as $photo) {
            Storage::disk('public')->delete($photo->image);
        }
        $shopItem->delete();
        SiteRebuild::markDirty('shop');

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
        SiteRebuild::markDirty('shop');

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
        SiteRebuild::markDirty('shop');

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
        SiteRebuild::markDirty('shop');

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
        SiteRebuild::markDirty('shop');

        return response()->json(['currencies' => $profile->shop_currencies]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'name'             => 'required|string|max:255',
            'type'             => 'sometimes|in:record,apparel,accessory,ticket,bundle,other',
            'description'      => 'nullable|string',
            'is_available'     => 'boolean',
            'is_presale'       => 'boolean',
            'presale_ships_at' => 'nullable|date',
            'stock_quantity'   => 'nullable|integer|min:0',
            'purchase_url'     => 'nullable|url|max:1000',
            'sort_order'       => 'integer|min:0',
        ] + ShopItem::translatedSlugRules($ignoreId));
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
