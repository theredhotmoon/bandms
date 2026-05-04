<?php

namespace App\Http\Controllers;

use App\Http\Resources\PhotoResource;
use App\Http\Resources\PhotoSummaryResource;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;

class PhotoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $photos = Photo::select(['id', 'title', 'slug', 'description', 'venue_id', 'concert_id', 'taken_at', 'published_at', 'created_at', 'updated_at'])
            ->with(['venue', 'concert', 'tags', 'posts'])
            ->when(
                $request->filled('search'),
                fn ($q) => $q->where(fn ($q) => $q
                    ->where('title', 'like', '%' . $request->search . '%')
                    ->orWhere('description', 'like', '%' . $request->search . '%')
                )
            )
            ->when(
                $request->filled('venue_id'),
                fn ($q) => $q->where('venue_id', $request->venue_id)
            )
            ->when(
                $request->filled('concert_id'),
                fn ($q) => $q->where('concert_id', $request->concert_id)
            )
            ->when(
                $request->filled('tag_id'),
                fn ($q) => $q->whereHas('tags', fn ($q) => $q->where('tags.id', $request->tag_id))
            )
            ->when(
                $request->filled('post_id'),
                fn ($q) => $q->whereHas('posts', fn ($q) => $q->where('posts.id', $request->post_id))
            )
            ->orderByDesc('taken_at')
            ->orderByDesc('created_at')
            ->get();

        return PhotoSummaryResource::collection($photos);
    }

    public function store(Request $request): PhotoResource
    {
        $data = $request->validate([
            'title'        => 'required|string|max:255',
            'description'  => 'nullable|string',
            'image'        => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'venue_id'     => 'nullable|integer|exists:venues,id',
            'concert_id'   => 'nullable|integer|exists:concerts,id',
            'taken_at'     => 'nullable|date',
            'published_at' => 'nullable|date',
            'tag_ids'      => 'nullable|array',
            'tag_ids.*'    => 'integer|exists:tags,id',
            'post_ids'     => 'nullable|array',
            'post_ids.*'   => 'integer|exists:posts,id',
        ]);

        $photo = Photo::create([
            'title'        => $data['title'],
            'slug'         => Photo::generateSlug($data['title']),
            'description'  => $data['description'] ?? null,
            'image'        => $data['image'] ?? null,
            'venue_id'     => $data['venue_id'] ?? null,
            'concert_id'   => $data['concert_id'] ?? null,
            'taken_at'     => $data['taken_at'] ?? null,
            'published_at' => $data['published_at'] ?? null,
        ]);

        if (!empty($data['tag_ids'])) {
            $photo->tags()->sync($data['tag_ids']);
        }

        if (!empty($data['post_ids'])) {
            $photo->posts()->sync($data['post_ids']);
        }

        return new PhotoResource($photo->load(['venue', 'concert', 'tags', 'posts']));
    }

    public function show(Photo $photo): PhotoResource
    {
        return new PhotoResource($photo->load(['venue', 'concert', 'tags', 'posts']));
    }

    public function update(Request $request, Photo $photo): PhotoResource
    {
        $data = $request->validate([
            'title'        => 'sometimes|required|string|max:255',
            'description'  => 'nullable|string',
            'image'        => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'venue_id'     => 'nullable|integer|exists:venues,id',
            'concert_id'   => 'nullable|integer|exists:concerts,id',
            'taken_at'     => 'nullable|date',
            'published_at' => 'nullable|date',
            'tag_ids'      => 'nullable|array',
            'tag_ids.*'    => 'integer|exists:tags,id',
            'post_ids'     => 'nullable|array',
            'post_ids.*'   => 'integer|exists:posts,id',
        ]);

        $photo->update(Arr::except($data, ['tag_ids', 'post_ids']));

        if (array_key_exists('tag_ids', $data)) {
            $photo->tags()->sync($data['tag_ids'] ?? []);
        }

        if (array_key_exists('post_ids', $data)) {
            $photo->posts()->sync($data['post_ids'] ?? []);
        }

        return new PhotoResource($photo->load(['venue', 'concert', 'tags', 'posts']));
    }

    public function destroy(Photo $photo): JsonResponse
    {
        $photo->delete();

        return response()->json(null, 204);
    }
}
