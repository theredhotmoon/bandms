<?php

namespace App\Http\Controllers;

use App\Models\MusicVideo;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class YouTubeSyncController extends Controller
{
    private const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
    private const BATCH_SIZE    = 50;

    private const YT_ID_PATTERN =
        '/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/';

    public function syncViewCounts(): JsonResponse
    {
        $apiKey = config('services.youtube.api_key');
        if (!$apiKey) {
            return response()->json(['message' => 'YouTube API key not configured. Set YOUTUBE_API_KEY in .env.'], 503);
        }

        $videos = MusicVideo::where('profile_id', 1)->get();

        // Map video_id → MusicVideo for quick lookup
        $ytMap = [];
        foreach ($videos as $video) {
            if (preg_match(self::YT_ID_PATTERN, $video->video_url, $m)) {
                $ytMap[$m[1]] = $video;
            }
        }

        if (empty($ytMap)) {
            return response()->json([
                'message'     => 'No YouTube videos found.',
                'updated'     => 0,
                'total_views' => 0,
                'results'     => [],
            ]);
        }

        $videoIds  = array_keys($ytMap);
        $batches   = array_chunk($videoIds, self::BATCH_SIZE);
        $results   = [];
        $totalViews = 0;

        foreach ($batches as $batch) {
            $response = Http::timeout(15)->get(self::YT_VIDEOS_URL, [
                'part' => 'statistics',
                'id'   => implode(',', $batch),
                'key'  => $apiKey,
            ]);

            if (!$response->successful()) {
                Log::error('YouTube API error: ' . $response->body());
                return response()->json(['message' => 'YouTube API request failed: ' . $response->status()], 502);
            }

            foreach ($response->json('items', []) as $item) {
                $ytId     = $item['id'];
                $views    = (int) ($item['statistics']['viewCount'] ?? 0);
                $model    = $ytMap[$ytId] ?? null;

                if (!$model) continue;

                $model->update([
                    'view_count'      => $views,
                    'views_synced_at' => now(),
                ]);

                $results[]   = ['id' => $model->id, 'title' => $model->title, 'view_count' => $views];
                $totalViews += $views;
            }
        }

        return response()->json([
            'message'     => 'Views synced successfully.',
            'updated'     => count($results),
            'skipped'     => count($videos) - count($ytMap),
            'total_views' => $totalViews,
            'synced_at'   => now()->toIso8601String(),
            'results'     => $results,
        ]);
    }
}
