<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CategoryResource::collection(Category::orderBy('name')->get());
    }

    public function store(Request $request): CategoryResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('categories')],
        ]);

        $category = Category::create([
            'name' => $data['name'],
            'slug' => Category::generateSlug($data['name']),
        ]);

        return new CategoryResource($category);
    }

    public function show(Category $category): CategoryResource
    {
        return new CategoryResource($category);
    }

    public function update(Request $request, Category $category): CategoryResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('categories')->ignore($category)],
        ]);

        $category->update([
            'name' => $data['name'],
            'slug' => Category::generateSlug($data['name'], $category->id),
        ]);

        return new CategoryResource($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        $category->delete();

        return response()->json(null, 204);
    }
}
