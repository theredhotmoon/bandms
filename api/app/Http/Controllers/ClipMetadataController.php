<?php

namespace App\Http\Controllers;

use App\Models\Clip;
use App\Support\EmbedProvider;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * What a video's own site says about it: the admin form's Retrieve button,
 * and the YouTube view-count sync. Both used to be music-video endpoints;
 * every video is a clip now.
 *
 * The YouTube Data API key travels in the `X-Goog-Api-Key` header, never the
 * query string — a connection error prints the full URL, and that text can
 * reach a log an admin reads.
 */
class ClipMetadataController extends Controller
{
    private const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
    private const BATCH_SIZE    = 50;

    /** oEmbed endpoints that need no key. Instagram and Facebook do, so they are absent. */
    private const OEMBED = [
        'youtube' => 'https://www.youtube.com/oembed',
        'vimeo'   => 'https://vimeo.com/api/oembed.json',
        'tiktok'  => 'https://www.tiktok.com/oembed',
    ];

    public function retrieve(Request $request): JsonResponse
    {
        $request->validate(['url' => 'required|url|max:2048']);
        $url      = (string) $request->input('url');
        $provider = EmbedProvider::detect($url);

        if (! isset(self::OEMBED[$provider])) {
            return response()->json(['message' => 'Details can only be retrieved for YouTube, Vimeo and TikTok links.'], 422);
        }

        $res = Http::timeout(10)->get(self::OEMBED[$provider], ['url' => $url, 'format' => 'json']);
        if (! $res->successful()) {
            return response()->json(['message' => 'Could not retrieve details for this URL.'], 422);
        }

        $oembed = $res->json();
        $meta = [
            'title'         => $oembed['title'] ?? null,
            // TikTok's is a signed CDN link that expires within days: stored, it
            // would be a broken image on the Videos page by next week.
            'thumbnail_url' => $provider === 'tiktok' ? null : ($oembed['thumbnail_url'] ?? null),
            'channel_name'  => $oembed['author_name'] ?? null,
            'channel_url'   => $oembed['author_url'] ?? null,
            'provider_name' => $oembed['provider_name'] ?? null,
            'view_count'    => null,
            'duration'      => null,
        ];

        // Views and duration need the Data API, which is optional.
        $apiKey = config('services.youtube.api_key');
        $ytId   = $provider === 'youtube' ? EmbedProvider::embedId($url) : null;
        if ($apiKey && $ytId) {
            $item = Http::timeout(10)->withHeaders(['X-Goog-Api-Key' => $apiKey])
                ->get(self::YT_VIDEOS_URL, ['part' => 'statistics,contentDetails', 'id' => $ytId])
                ->json('items.0');
            if (is_array($item)) {
                $meta['view_count'] = isset($item['statistics']['viewCount']) ? (int) $item['statistics']['viewCount'] : null;
                $meta['duration']   = self::duration($item['contentDetails']['duration'] ?? null);
            }
        }

        return response()->json($meta);
    }

    public function syncViews(): JsonResponse
    {
        $apiKey = config('services.youtube.api_key');
        if (! $apiKey) {
            return response()->json(['message' => 'YouTube API key not configured. Set YOUTUBE_API_KEY in .env.'], 503);
        }

        $clips = Clip::where('provider', 'youtube')->get();

        // YouTube id => clips. One video can be in the library twice (a fan
        // re-upload of the same id is rare, but nothing forbids it).
        $byId = [];
        foreach ($clips as $clip) {
            if ($id = EmbedProvider::embedId($clip->url)) {
                $byId[$id][] = $clip;
            }
        }

        $results    = [];
        $totalViews = 0;

        foreach (array_chunk(array_keys($byId), self::BATCH_SIZE) as $batch) {
            $response = Http::timeout(15)->withHeaders(['X-Goog-Api-Key' => $apiKey])
                ->get(self::YT_VIDEOS_URL, ['part' => 'statistics', 'id' => implode(',', $batch)]);

            if (! $response->successful()) {
                Log::error('YouTube API error: ' . $response->status());

                return response()->json(['message' => 'YouTube API request failed: ' . $response->status()], 502);
            }

            foreach ($response->json('items', []) as $item) {
                $views = (int) ($item['statistics']['viewCount'] ?? 0);
                foreach ($byId[$item['id']] ?? [] as $clip) {
                    $clip->update(['view_count' => $views, 'views_synced_at' => now()]);
                    $results[]   = ['id' => $clip->id, 'title' => $clip->title, 'view_count' => $views];
                    $totalViews += $views;
                }
            }
        }

        // The Videos and Music pages print view counts.
        if ($results !== []) {
            SiteRebuild::markDirty('music-videos');
            SiteRebuild::markDirty('releases');
        }

        return response()->json([
            'message'     => 'Views synced successfully.',
            'updated'     => count($results),
            'total_views' => $totalViews,
            'synced_at'   => now()->toIso8601String(),
            'results'     => $results,
        ]);
    }

    /** ISO 8601 → "4:33" / "1:04:33". */
    private static function duration(?string $iso): ?string
    {
        if (! $iso || preg_match('/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/', $iso, $m) !== 1) {
            return null;
        }
        [$h, $i, $s] = [(int) ($m[1] ?? 0), (int) ($m[2] ?? 0), (int) ($m[3] ?? 0)];

        return $h > 0 ? sprintf('%d:%02d:%02d', $h, $i, $s) : sprintf('%d:%02d', $i, $s);
    }
}
