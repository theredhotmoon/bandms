<?php

namespace App\Http\Controllers;

use Illuminate\Support\Arr;
use App\Models\BandProfile;
use App\Models\MusicVideo;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MusicVideoController extends Controller
{
    public function index(): JsonResponse
    {
        // `members` rides along: the admin form is seeded from this list, and
        // without member_ids a save would clear the video's members.
        $items = MusicVideo::with('members')->where('profile_id', 1)->orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['data' => $items->map(fn ($v) => $this->format($v))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'required|string|max:255',
            'video_url'    => 'required|url|max:500',
            'published_at' => 'nullable|date_format:Y-m-d',
            'sort_order'   => 'integer|min:0',
            'og_title'     => 'nullable|string|max:500',
            'og_image'     => 'nullable|url|max:1000',
            'channel_name' => 'nullable|string|max:255',
            'view_count'   => 'nullable|integer|min:0',
            'duration'     => 'nullable|string|max:20',
            // Who is in it. Absent leaves them alone; [] clears them.
            'member_ids'   => 'sometimes|nullable|array',
            'member_ids.*' => 'integer|distinct|exists:band_members,id',
        ]);

        $data['profile_id'] = BandProfile::value('id') ?? 1;
        $item = MusicVideo::create(Arr::except($data, ['member_ids']));
        $this->syncMembers($item, $data);
        $item->load('members');

        SiteRebuild::markDirty('music-videos');

        return response()->json(['data' => $this->format($item)], 201);
    }

    public function update(Request $request, MusicVideo $musicVideo): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'sometimes|required|string|max:255',
            'video_url'    => 'sometimes|required|url|max:500',
            'published_at' => 'nullable|date_format:Y-m-d',
            'sort_order'   => 'integer|min:0',
            'og_title'     => 'nullable|string|max:500',
            'og_image'     => 'nullable|url|max:1000',
            'channel_name' => 'nullable|string|max:255',
            'view_count'   => 'nullable|integer|min:0',
            'duration'     => 'nullable|string|max:20',
            // Who is in it. Absent leaves them alone; [] clears them.
            'member_ids'   => 'sometimes|nullable|array',
            'member_ids.*' => 'integer|distinct|exists:band_members,id',
        ]);

        $musicVideo->update(Arr::except($data, ['member_ids']));
        $this->syncMembers($musicVideo, $data);
        $musicVideo->load('members');

        SiteRebuild::markDirty('music-videos');

        return response()->json(['data' => $this->format($musicVideo)]);
    }

    public function retrieveMetadata(Request $request): JsonResponse
    {
        $request->validate(['url' => 'required|url|max:500']);
        $url = $request->input('url');

        $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');
        $allowed = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com'];
        if (! in_array($host, $allowed, true)) {
            return response()->json(['message' => 'Only YouTube and Vimeo URLs are supported.'], 422);
        }

        $isYouTube = str_contains($host, 'youtu');

        // oEmbed — always available, no API key needed
        $oembedUrl = $isYouTube
            ? 'https://www.youtube.com/oembed?url=' . urlencode($url) . '&format=json'
            : 'https://vimeo.com/api/oembed.json?url=' . urlencode($url);

        $oembedRes = Http::timeout(10)->get($oembedUrl);
        if (! $oembedRes->successful()) {
            return response()->json(['message' => 'Could not retrieve metadata for this URL.'], 422);
        }

        $oembed = $oembedRes->json();

        $meta = [
            'title'         => $oembed['title'] ?? null,
            'thumbnail_url' => $oembed['thumbnail_url'] ?? null,
            'channel_name'  => $oembed['author_name'] ?? null,
            'provider_name' => $oembed['provider_name'] ?? null,
            'view_count'    => null,
            'duration'      => null,
        ];

        // YouTube Data API — optional, needs YOUTUBE_API_KEY
        if ($isYouTube) {
            $apiKey = config('services.youtube.api_key');
            $ytId   = null;
            if (preg_match('/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/', $url, $m)) {
                $ytId = $m[1];
            }

            if ($apiKey && $ytId) {
                $ytRes = Http::timeout(10)->get('https://www.googleapis.com/youtube/v3/videos', [
                    'part' => 'statistics,contentDetails',
                    'id'   => $ytId,
                    'key'  => $apiKey,
                ]);

                if ($ytRes->successful()) {
                    $item = $ytRes->json('items.0');
                    if ($item) {
                        $meta['view_count'] = isset($item['statistics']['viewCount'])
                            ? (int) $item['statistics']['viewCount']
                            : null;
                        $meta['duration']   = $this->parseDuration($item['contentDetails']['duration'] ?? null);
                    }
                }
            }
        }

        return response()->json($meta);
    }

    public function destroy(MusicVideo $musicVideo): JsonResponse
    {
        $musicVideo->delete();

        SiteRebuild::markDirty('music-videos');

        return response()->json(null, 204);
    }

    public function fetchPreview(MusicVideo $musicVideo): JsonResponse
    {
        $url  = $musicVideo->video_url;
        $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');

        $oembedUrl = str_contains($host, 'vimeo')
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

        SiteRebuild::markDirty('music-videos');

        return response()->json(['data' => $this->format($musicVideo->fresh())]);
    }

    /**
     * Who is in the video. Keyed on presence: an explicit [] clears them, a
     * save that never mentions them leaves them alone. Only a real change
     * marks member pages for a rebuild.
     */
    private function syncMembers(MusicVideo $video, array $data): void
    {
        if (! array_key_exists('member_ids', $data)) {
            return;
        }
        if (array_filter($video->members()->sync($data['member_ids'] ?? []))) {
            SiteRebuild::markDirty('band-members');
        }
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
            'duration'        => $v->duration,
            'member_ids'      => $v->relationLoaded('members') ? $v->members->pluck('id')->values() : null,
            'views_synced_at' => $v->views_synced_at?->toIso8601String(),
            'created_at'      => $v->created_at,
            'updated_at'      => $v->updated_at,
        ];
    }

    private function parseDuration(?string $iso): ?string
    {
        if (!$iso) return null;
        // ISO 8601: PT1H4M33S → 1:04:33 / PT4M33S → 4:33
        preg_match('/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/', $iso, $m);
        $h = (int) ($m[1] ?? 0);
        $i = (int) ($m[2] ?? 0);
        $s = (int) ($m[3] ?? 0);
        if ($h > 0) {
            return sprintf('%d:%02d:%02d', $h, $i, $s);
        }
        return sprintf('%d:%02d', $i, $s);
    }
}
