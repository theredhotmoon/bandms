<?php

namespace App\Http\Controllers;

use App\Http\Resources\WebsiteModuleResource;
use App\Models\SiteSetting;
use App\Models\WebsiteModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WebsiteModuleController extends Controller
{
    public function siteConfig(): JsonResponse
    {
        $modules = WebsiteModule::all(['slug', 'enabled'])
            ->keyBy('slug')
            ->map(fn ($m) => (bool) $m->enabled);

        return response()->json(['modules' => $modules]);
    }

    public function index(): JsonResponse
    {
        $modules     = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();
        $autoRebuild = SiteSetting::get('auto_rebuild', 'false') === 'true';

        return response()->json([
            'data'         => WebsiteModuleResource::collection($modules),
            'auto_rebuild' => $autoRebuild,
        ]);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $module = WebsiteModule::where('slug', $slug)->firstOrFail();

        $validated = $request->validate(['enabled' => 'required|boolean']);
        $module->update($validated);

        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            $this->triggerRebuild();
        }

        return response()->json(['data' => new WebsiteModuleResource($module)]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(['auto_rebuild' => 'required|boolean']);

        SiteSetting::set('auto_rebuild', $validated['auto_rebuild'] ? 'true' : 'false');

        return response()->json(['auto_rebuild' => $validated['auto_rebuild']]);
    }

    public function rebuild(): JsonResponse
    {
        $this->triggerRebuild();

        return response()->json(['status' => 'rebuild_started']);
    }

    private function triggerRebuild(): void
    {
        try {
            Http::timeout(5)->post('http://web:3001/rebuild');
        } catch (\Exception) {
            // Fire-and-forget; webhook may be unavailable in tests or dev
        }
    }
}
