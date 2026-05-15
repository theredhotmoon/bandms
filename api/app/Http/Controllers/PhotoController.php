<?php

namespace App\Http\Controllers;

use App\Http\Resources\PhotoResource;
use App\Models\Photo;
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

        return new PhotoResource($photo->load('album'));
    }

    public function destroy(Photo $photo): JsonResponse
    {
        if ($photo->image) {
            Storage::disk('public')->delete($photo->image);
        }

        $photo->delete();

        return response()->json(null, 204);
    }
}
