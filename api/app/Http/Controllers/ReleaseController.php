<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReleaseResource;
use App\Http\Resources\ReleaseSummaryResource;
use App\Models\BandProfile;
use App\Models\Release;
use App\Models\ReleasePhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class ReleaseController extends Controller
{
    public function index(): ResourceCollection
    {
        $releases = Release::with('links')->orderByDesc('release_date')->orderByDesc('id')->get();

        return ReleaseSummaryResource::collection($releases);
    }

    public function show(Release $release): ReleaseResource
    {
        $release->load('tracks.links', 'links', 'photos');

        return new ReleaseResource($release);
    }

    public function store(Request $request): ReleaseResource
    {
        $validated = $request->validate([
            'title'                           => 'required',
            'title.en'                        => 'nullable|string|max:255',
            'title.pl'                        => 'nullable|string|max:255',
            'type'                            => 'required|in:LP,EP,single,compilation',
            'release_date'                    => 'nullable|date',
            'description'                     => 'nullable',
            'description.en'                  => 'nullable|string',
            'description.pl'                  => 'nullable|string',
            'is_upcoming'                     => 'boolean',
            'presave_url'                     => 'nullable|url|max:500',
            'label_name'                      => 'nullable|string|max:255',
            'links'                           => 'nullable|array',
            'links.*.platform'                => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'links.*.url'                     => 'required|url|max:500',
            'tracks'                          => 'nullable|array',
            'tracks.*.title'                  => 'required|string|max:255',
            'tracks.*.duration'               => 'nullable|string|max:20',
            'tracks.*.lyrics'                 => 'nullable|string',
            'tracks.*.sort_order'             => 'integer|min:0',
            'tracks.*.bpm'                    => 'nullable|integer|min:1|max:400',
            'tracks.*.musical_key'            => 'nullable|string|max:10',
            'tracks.*.mood_tags'              => 'nullable|string|max:500',
            'tracks.*.isrc'                   => 'nullable|string|max:20',
            'tracks.*.explicit'               => 'boolean',
            'tracks.*.stems_available'        => 'boolean',
            'tracks.*.sync_placements'        => 'nullable|string|max:1000',
            'tracks.*.links'                  => 'nullable|array',
            'tracks.*.links.*.platform'       => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'tracks.*.links.*.url'            => 'required|url|max:500',
        ]);

        $validated['profile_id'] = BandProfile::value('id') ?? 1;

        $release = Release::create($validated);

        foreach ($request->input('links', []) as $link) {
            $release->links()->create($link);
        }

        foreach ($request->input('tracks', []) as $trackData) {
            $trackLinks = $trackData['links'] ?? [];
            unset($trackData['links']);
            $track = $release->tracks()->create($trackData);
            foreach ($trackLinks as $link) {
                $track->links()->create($link);
            }
        }

        $release->load('tracks.links', 'links', 'photos');

        return new ReleaseResource($release);
    }

    public function update(Request $request, Release $release): ReleaseResource
    {
        $validated = $request->validate([
            'title'                           => 'required',
            'title.en'                        => 'nullable|string|max:255',
            'title.pl'                        => 'nullable|string|max:255',
            'type'                            => 'required|in:LP,EP,single,compilation',
            'release_date'                    => 'nullable|date',
            'description'                     => 'nullable',
            'description.en'                  => 'nullable|string',
            'description.pl'                  => 'nullable|string',
            'is_upcoming'                     => 'boolean',
            'presave_url'                     => 'nullable|url|max:500',
            'label_name'                      => 'nullable|string|max:255',
            'links'                           => 'nullable|array',
            'links.*.platform'                => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'links.*.url'                     => 'required|url|max:500',
            'tracks'                          => 'nullable|array',
            'tracks.*.title'                  => 'required|string|max:255',
            'tracks.*.duration'               => 'nullable|string|max:20',
            'tracks.*.lyrics'                 => 'nullable|string',
            'tracks.*.sort_order'             => 'integer|min:0',
            'tracks.*.bpm'                    => 'nullable|integer|min:1|max:400',
            'tracks.*.musical_key'            => 'nullable|string|max:10',
            'tracks.*.mood_tags'              => 'nullable|string|max:500',
            'tracks.*.isrc'                   => 'nullable|string|max:20',
            'tracks.*.explicit'               => 'boolean',
            'tracks.*.stems_available'        => 'boolean',
            'tracks.*.sync_placements'        => 'nullable|string|max:1000',
            'tracks.*.links'                  => 'nullable|array',
            'tracks.*.links.*.platform'       => 'required|in:spotify,apple_music,bandcamp,youtube,instagram',
            'tracks.*.links.*.url'            => 'required|url|max:500',
        ]);

        $release->update($validated);

        $release->links()->delete();
        foreach ($request->input('links', []) as $link) {
            $release->links()->create($link);
        }

        $release->tracks()->delete();
        foreach ($request->input('tracks', []) as $trackData) {
            $trackLinks = $trackData['links'] ?? [];
            unset($trackData['links']);
            $track = $release->tracks()->create($trackData);
            foreach ($trackLinks as $link) {
                $track->links()->create($link);
            }
        }

        $release->load('tracks.links', 'links', 'photos');

        return new ReleaseResource($release);
    }

    public function destroy(Release $release): Response
    {
        if ($release->cover_image) {
            Storage::disk('public')->delete($release->cover_image);
        }

        foreach ($release->photos as $photo) {
            Storage::disk('public')->delete($photo->image);
        }

        $release->delete();

        return response()->noContent();
    }

    public function uploadCover(Request $request, Release $release): ReleaseResource
    {
        $request->validate(['cover' => 'required|image|max:4096']);

        if ($release->cover_image) {
            Storage::disk('public')->delete($release->cover_image);
        }

        $path = $request->file('cover')->store('release-covers', 'public');
        $release->update(['cover_image' => $path]);

        return new ReleaseResource($release->load(['tracks.links', 'links', 'photos']));
    }

    public function destroyCover(Release $release): ReleaseResource
    {
        if ($release->cover_image) {
            Storage::disk('public')->delete($release->cover_image);
            $release->update(['cover_image' => null]);
        }

        return new ReleaseResource($release->load(['tracks.links', 'links', 'photos']));
    }

    public function addPhotos(Request $request, Release $release): ReleaseResource
    {
        $request->validate([
            'files'      => 'required|array|min:1|max:20',
            'files.*'    => 'required|image|max:10240',
            'captions'   => 'nullable|array',
            'captions.*' => 'nullable|string|max:255',
        ]);

        $nextOrder = ($release->photos()->max('sort_order') ?? -1) + 1;

        foreach ($request->file('files') as $i => $file) {
            $path = $file->store('release-photos', 'public');
            $release->photos()->create([
                'image'      => $path,
                'sort_order' => $nextOrder++,
                'caption'    => $request->input("captions.$i"),
            ]);
        }

        return new ReleaseResource($release->load(['tracks.links', 'links', 'photos']));
    }

    public function removePhoto(Release $release, ReleasePhoto $photo): Response
    {
        Storage::disk('public')->delete($photo->image);
        $photo->delete();

        return response()->noContent();
    }

    public function reorderPhotos(Request $request, Release $release): ReleaseResource
    {
        $data = $request->validate([
            'order'   => 'required|array',
            'order.*' => 'integer|exists:release_photos,id',
        ]);

        foreach ($data['order'] as $sortOrder => $photoId) {
            $release->photos()->where('id', $photoId)->update(['sort_order' => $sortOrder]);
        }

        return new ReleaseResource($release->load(['tracks.links', 'links', 'photos']));
    }
}
