<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReleaseResource;
use App\Http\Resources\ReleaseSummaryResource;
use App\Models\Release;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class ReleaseController extends Controller
{
    public function index(): ResourceCollection
    {
        $releases = Release::with('band')
            ->orderByDesc('release_date')
            ->orderByDesc('id')
            ->get();

        return ReleaseSummaryResource::collection($releases);
    }

    public function show(Release $release): ReleaseResource
    {
        $release->load('band', 'tracks', 'links');

        return new ReleaseResource($release);
    }

    public function store(Request $request): ReleaseResource
    {
        $validated = $request->validate([
            'band_id'          => 'required|exists:bands,id',
            'title'            => 'required|string|max:255',
            'type'             => 'required|in:LP,EP,single,compilation',
            'release_date'     => 'nullable|date',
            'cover_image'      => 'nullable|url|max:500',
            'description'      => 'nullable|string',
            'links'            => 'nullable|array',
            'links.*.platform' => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'links.*.url'      => 'required|url|max:500',
            'tracks'           => 'nullable|array',
            'tracks.*.title'      => 'required|string|max:255',
            'tracks.*.duration'   => 'nullable|string|max:20',
            'tracks.*.lyrics'     => 'nullable|string',
            'tracks.*.sort_order' => 'integer|min:0',
        ]);

        $release = Release::create($validated);

        foreach ($request->input('links', []) as $link) {
            $release->links()->create($link);
        }

        foreach ($request->input('tracks', []) as $track) {
            $release->tracks()->create($track);
        }

        $release->load('band', 'tracks', 'links');

        return new ReleaseResource($release);
    }

    public function update(Request $request, Release $release): ReleaseResource
    {
        $validated = $request->validate([
            'band_id'          => 'required|exists:bands,id',
            'title'            => 'required|string|max:255',
            'type'             => 'required|in:LP,EP,single,compilation',
            'release_date'     => 'nullable|date',
            'cover_image'      => 'nullable|url|max:500',
            'description'      => 'nullable|string',
            'links'            => 'nullable|array',
            'links.*.platform' => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'links.*.url'      => 'required|url|max:500',
            'tracks'           => 'nullable|array',
            'tracks.*.title'      => 'required|string|max:255',
            'tracks.*.duration'   => 'nullable|string|max:20',
            'tracks.*.lyrics'     => 'nullable|string',
            'tracks.*.sort_order' => 'integer|min:0',
        ]);

        $release->update($validated);

        $release->links()->delete();
        foreach ($request->input('links', []) as $link) {
            $release->links()->create($link);
        }

        $release->tracks()->delete();
        foreach ($request->input('tracks', []) as $track) {
            $release->tracks()->create($track);
        }

        $release->load('band', 'tracks', 'links');

        return new ReleaseResource($release);
    }

    public function destroy(Release $release): \Illuminate\Http\Response
    {
        $release->delete();

        return response()->noContent();
    }
}
