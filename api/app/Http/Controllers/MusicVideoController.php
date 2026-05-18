<?php

namespace App\Http\Controllers;

use App\Models\BandProfile;
use App\Models\MusicVideo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MusicVideoController extends Controller
{
    public function index(): JsonResponse
    {
        $items = MusicVideo::where('profile_id', 1)->orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['data' => $items->map(fn ($v) => $this->format($v))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'required|string|max:255',
            'video_url'    => 'required|url|max:500',
            'published_at' => 'nullable|date_format:Y-m-d',
            'sort_order'   => 'integer|min:0',
        ]);

        $data['profile_id'] = BandProfile::value('id') ?? 1;
        $item = MusicVideo::create($data);

        return response()->json(['data' => $this->format($item)], 201);
    }

    public function update(Request $request, MusicVideo $musicVideo): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'sometimes|required|string|max:255',
            'video_url'    => 'sometimes|required|url|max:500',
            'published_at' => 'nullable|date_format:Y-m-d',
            'sort_order'   => 'integer|min:0',
        ]);

        $musicVideo->update($data);
        return response()->json(['data' => $this->format($musicVideo)]);
    }

    public function destroy(MusicVideo $musicVideo): JsonResponse
    {
        $musicVideo->delete();
        return response()->json(null, 204);
    }

    public function fetchPreview(MusicVideo $musicVideo): JsonResponse
    {
        $url = $musicVideo->video_url;

        $oembedUrl = str_contains($url, 'vimeo')
            ? 'https://vimeo.com/api/oembed.json?url=' . urlencode($url)
            : 'https://www.youtube.com/oembed?url=' . urlencode($url) . '&format=json';

        $response = Http::timeout(10)->get($oembedUrl);

        if (! $response->successful()) {
            return response()->json(['message' => 'Could not fetch preview for this URL.'], 422);
        }

        $data = $response->json();

        $musicVideo->update([
            'og_title'     => $data['title'] ?? null,
            'og_image'     => $data['thumbnail_url'] ?? null,
            'og_site_name' => $data['provider_name'] ?? null,
            'channel_name' => $data['author_name'] ?? null,
        ]);

        return response()->json(['data' => $this->format($musicVideo->fresh())]);
    }

    private function format(MusicVideo $v): array
    {
        return [
            'id'              => $v->id,
            'title'           => $v->title,
            'video_url'       => $v->video_url,
            'published_at'    => $v->published_at?->format('Y-m-d'),
            'sort_order'      => $v->sort_order,
            'og_title'        => $v->og_title,
            'og_image'        => $v->og_image,
            'og_site_name'    => $v->og_site_name,
            'channel_name'    => $v->channel_name,
            'view_count'      => $v->view_count,
            'views_synced_at' => $v->views_synced_at?->toIso8601String(),
            'created_at'      => $v->created_at,
            'updated_at'      => $v->updated_at,
        ];
    }
}
