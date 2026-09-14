<?php

namespace App\Http\Controllers;

use App\Models\SiteSetting;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SiteRebuildController extends Controller
{
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(['auto_rebuild' => 'required|boolean']);

        SiteSetting::set('auto_rebuild', $validated['auto_rebuild'] ? 'true' : 'false');

        return response()->json(['auto_rebuild' => $validated['auto_rebuild']]);
    }

    public function rebuild(): JsonResponse
    {
        SiteRebuild::request();
        SiteRebuild::clearPending();

        return response()->json(['status' => 'rebuild_started']);
    }

    public function rebuildStatus(): JsonResponse
    {
        $status = ['status' => 'unknown', 'startedAt' => null, 'finishedAt' => null];

        try {
            $response = Http::timeout(5)->get('http://web:3001/status');
            if ($response->successful()) {
                $body = $response->json();
                $status = [
                    'status'     => $body['status']     ?? 'unknown',
                    'startedAt'  => $body['startedAt']  ?? null,
                    'finishedAt' => $body['finishedAt'] ?? null,
                ];
            }
        } catch (\Exception) {
            // fall through with the 'unknown' defaults above
        }

        return response()->json([
            ...$status,
            'autoRebuild'  => SiteSetting::get('auto_rebuild', 'false') === 'true',
            'pendingAreas' => SiteRebuild::pendingAreas(),
        ]);
    }
}
