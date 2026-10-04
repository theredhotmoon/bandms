<?php

namespace App\Http\Controllers;

use App\Http\Resources\PhotoResource;
use App\Models\Photo;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

class PhotoController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $photos = Photo::with('album')->orderBy('sort_order')->get();
        return PhotoResource::collection($photos);
    }

    public function show(Photo $photo): PhotoResource
    {
        return new PhotoResource($photo->load('album'));
    }

    public function update(Request $request, Photo $photo): PhotoResource
    {
        $data = $request->validate([
            'caption'      => 'nullable|string|max:255',
            'sort_order'   => 'nullable|integer|min:0',
            'epk_featured' => 'nullable|boolean',
        ]);

        $photo->update($data);

        SiteRebuild::markDirty('photos');

        return new PhotoResource($photo->load('album'));
    }

    /**
     * Who is in this photo. Replaces the whole set — the admin sends every
     * member it shows as checked, and an empty list clears them all.
     */
    public function syncMembers(Request $request, Photo $photo): PhotoResource
    {
        $data = $request->validate([
            'member_ids'   => 'present|array',
            'member_ids.*' => 'integer|distinct|exists:band_members,id',
        ]);

        $photo->members()->sync($data['member_ids']);

        // The album pages carry nothing about members, but each member's own
        // page lists their photos.
        SiteRebuild::markDirty('band-members');

        return new PhotoResource($photo->load(['album', 'members']));
    }

    public function destroy(Photo $photo): JsonResponse
    {
        if ($photo->image) {
            Storage::disk('public')->delete($photo->image);
        }

        $photo->delete();

        SiteRebuild::markDirty('photos');

        return response()->json(null, 204);
    }
}
