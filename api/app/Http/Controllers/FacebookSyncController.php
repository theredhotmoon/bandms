<?php

namespace App\Http\Controllers;

use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FacebookSyncController extends Controller
{
    private const GRAPH_URL = 'https://graph.facebook.com/v21.0';

    public function syncLikes(): JsonResponse
    {
        $appId     = config('services.facebook.app_id');
        $appSecret = config('services.facebook.app_secret');
        $pageId    = config('services.facebook.page_id');

        if (!$appId || !$appSecret || !$pageId) {
            return response()->json([
                'message' => 'Facebook credentials not configured. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and FACEBOOK_PAGE_ID in .env.',
            ], 503);
        }

        $accessToken = "{$appId}|{$appSecret}";

        $response = Http::timeout(15)->get(self::GRAPH_URL . '/' . $pageId, [
            'fields'       => 'fan_count',
            'access_token' => $accessToken,
        ]);

        if (!$response->successful()) {
            $error = $response->json('error.message', 'Unknown error');
            Log::error('Facebook Graph API error: ' . $response->body());
            return response()->json(['message' => 'Facebook API request failed: ' . $error], 502);
        }

        $likes = $response->json('fan_count');

        if ($likes === null) {
            return response()->json([
                'message' => 'Facebook did not return fan_count. The page may not be public or the credentials may lack access.',
            ], 422);
        }

        $profile = BandProfile::findOrFail(1);
        $profile->update([
            'facebook_likes'           => (int) $likes,
            'facebook_likes_synced_at' => now(),
        ]);

        return response()->json([
            'message'    => 'Facebook likes synced successfully.',
            'likes'      => (int) $likes,
            'synced_at'  => now()->toIso8601String(),
        ]);
    }
}
