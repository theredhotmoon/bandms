<?php

namespace App\Http\Controllers;

use App\Http\Resources\ShopCategoryResource;
use App\Models\BandProfile;
use App\Models\ShopCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ShopCategoryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ShopCategoryResource::collection(
            ShopCategory::orderBy('sort_order')->orderBy('name')->get()
        );
    }

    public function store(Request $request): ShopCategoryResource
    {
        $data = $this->validated($request);
        $data['profile_id'] = BandProfile::value('id') ?? 1;
        $data['slug']       = ShopCategory::generateSlug($data['name']);

        $category = ShopCategory::create($data);

        return new ShopCategoryResource($category);
    }

    public function update(Request $request, ShopCategory $shopCategory): ShopCategoryResource
    {
        $data = $this->validated($request, $shopCategory);

        if ($shopCategory->name !== $data['name']) {
            $data['slug'] = ShopCategory::generateSlug($data['name'], $shopCategory->id);
        }

        $shopCategory->update($data);

        return new ShopCategoryResource($shopCategory);
    }

    public function destroy(ShopCategory $shopCategory): JsonResponse
    {
        $shopCategory->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, ?ShopCategory $ignore = null): array
    {
        return $request->validate([
            'name'        => ['required', 'string', 'max:100',
                              Rule::unique('shop_categories')->ignore($ignore)],
            'description' => 'nullable|string|max:1000',
            'sort_order'  => 'integer|min:0',
        ]);
    }
}
