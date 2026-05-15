<?php

namespace App\Http\Controllers;

use App\Http\Resources\TagResource;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return TagResource::collection(Tag::orderBy('name')->get());
    }

    public function store(Request $request): TagResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('tags')],
        ]);

        $tag = Tag::create([
            'name' => $data['name'],
            'slug' => Tag::generateSlug($data['name']),
        ]);

        return new TagResource($tag);
    }

    public function show(Tag $tag): TagResource
    {
        return new TagResource($tag);
    }

    public function update(Request $request, Tag $tag): TagResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('tags')->ignore($tag)],
        ]);

        $tag->update([
            'name' => $data['name'],
            'slug' => Tag::generateSlug($data['name'], $tag->id),
        ]);

        return new TagResource($tag);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $tag->delete();

        return response()->json(null, 204);
    }
}
