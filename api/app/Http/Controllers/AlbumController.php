<?php

namespace App\Http\Controllers;

use App\Http\Resources\AlbumResource;
use App\Models\Album;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class AlbumController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $albums = Album::with(['venue', 'concert', 'tags', 'photos'])
            ->orderByDesc('taken_at')
            ->orderByDesc('created_at')
            ->get();

        return AlbumResource::collection($albums);
    }

    public function show(Album $album): AlbumResource
    {
        return new AlbumResource($album->load(['venue', 'concert', 'tags', 'photos']));
    }

    public function batchStore(Request $request): AlbumResource
    {
        $data = $request->validate([
            'title'        => 'required|string|max:255',
            'description'  => 'nullable|string',
            'venue_id'     => 'nullable|integer|exists:venues,id',
            'concert_id'   => 'nullable|integer|exists:concerts,id',
            'taken_at'     => 'nullable|date',
            'published_at' => 'nullable|date',
            'tag_ids'      => 'nullable|array',
            'tag_ids.*'    => 'integer|exists:tags,id',
            'files'        => 'required|array|min:1|max:100',
            'files.*'      => 'required|image|max:20480',
            'captions'     => 'nullable|array',
            'captions.*'   => 'nullable|string|max:255',
        ]);

        $album = Album::create([
            'title'        => $data['title'],
            'slug'         => Album::generateSlug($data['title']),
            'description'  => $data['description'] ?? null,
            'venue_id'     => $data['venue_id'] ?? null,
            'concert_id'   => $data['concert_id'] ?? null,
            'taken_at'     => $data['taken_at'] ?? null,
            'published_at' => $data['published_at'] ?? null,
        ]);

        if (!empty($data['tag_ids'])) {
            $album->tags()->sync($data['tag_ids']);
        }

        foreach (array_values($data['files']) as $index => $file) {
            $path = $file->store('photos', 'public');
            Photo::create([
                'album_id'   => $album->id,
                'image'      => $path,
                'sort_order' => $index,
                'caption'    => $data['captions'][$index] ?? null,
            ]);
        }

        return new AlbumResource($album->load(['venue', 'concert', 'tags', 'photos']));
    }

    public function update(Request $request, Album $album): AlbumResource
    {
        $data = $request->validate([
            'title'        => 'sometimes|required|string|max:255',
            'description'  => 'nullable|string',
            'venue_id'     => 'nullable|integer|exists:venues,id',
            'concert_id'   => 'nullable|integer|exists:concerts,id',
            'taken_at'     => 'nullable|date',
            'published_at' => 'nullable|date',
            'tag_ids'      => 'nullable|array',
            'tag_ids.*'    => 'integer|exists:tags,id',
        ]);

        $album->update(Arr::except($data, ['tag_ids']));

        if (array_key_exists('tag_ids', $data)) {
            $album->tags()->sync($data['tag_ids'] ?? []);
        }

        return new AlbumResource($album->load(['venue', 'concert', 'tags', 'photos']));
    }

    public function destroy(Album $album): JsonResponse
    {
        foreach ($album->photos as $photo) {
            if ($photo->image) {
                Storage::disk('public')->delete($photo->image);
            }
        }

        $album->delete();

        return response()->json(null, 204);
    }

    public function addPhotos(Request $request, Album $album): AlbumResource
    {
        $data = $request->validate([
            'files'    => 'required|array|min:1|max:100',
            'files.*'  => 'required|image|max:20480',
            'captions' => 'nullable|array',
            'captions.*' => 'nullable|string|max:255',
        ]);

        $maxOrder = $album->photos()->max('sort_order') ?? -1;

        foreach (array_values($data['files']) as $index => $file) {
            $path = $file->store('photos', 'public');
            Photo::create([
                'album_id'   => $album->id,
                'image'      => $path,
                'sort_order' => $maxOrder + 1 + $index,
                'caption'    => $data['captions'][$index] ?? null,
            ]);
        }

        return new AlbumResource($album->load(['venue', 'concert', 'tags', 'photos']));
    }

    public function removePhoto(Album $album, Photo $photo): JsonResponse
    {
        abort_if($photo->album_id !== $album->id, 404);

        if ($photo->image) {
            Storage::disk('public')->delete($photo->image);
        }

        $photo->delete();

        return response()->json(null, 204);
    }

    public function reorderPhotos(Request $request, Album $album): AlbumResource
    {
        $data = $request->validate([
            'order'   => 'required|array',
            'order.*' => 'integer|exists:photos,id',
        ]);

        foreach ($data['order'] as $sortOrder => $photoId) {
            $album->photos()->where('id', $photoId)->update(['sort_order' => $sortOrder]);
        }

        return new AlbumResource($album->load(['venue', 'concert', 'tags', 'photos']));
    }
}
