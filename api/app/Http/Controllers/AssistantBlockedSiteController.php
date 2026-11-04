<?php

namespace App\Http\Controllers;

use App\Models\AssistantBlockedSite;
use Illuminate\Http\JsonResponse;

/**
 * The sites, channels and accounts blocked from the inbox's "Wrong" button.
 * Blocking happens there (AssistantFindingController::update); this lists
 * them and unblocks one. Unblocking only lets new findings in again — what
 * was dismissed stays dismissed, restorable one by one.
 */
class AssistantBlockedSiteController extends Controller
{
    public function index(): JsonResponse
    {
        $sites = AssistantBlockedSite::query()->with('creator:id,name')->orderBy('label')->get();

        return response()->json(['data' => $sites->map(fn (AssistantBlockedSite $s) => [
            'id'         => $s->id,
            'key'        => $s->site_key,
            'label'      => $s->label,
            'created_by' => $s->creator?->name,
            'created_at' => $s->created_at,
        ])->all()]);
    }

    public function destroy(AssistantBlockedSite $site): JsonResponse
    {
        $site->delete();

        return response()->json(null, 204);
    }
}
