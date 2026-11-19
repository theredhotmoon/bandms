<?php

namespace App\Http\Controllers;

use App\Models\Concert;
use App\Models\WebsiteModule;
use App\Support\Geo\Locator;
use App\Support\WelcomeSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Which upcoming gigs are near the visitor. Fails open: anything that stops us
 * placing the visitor answers located:false. Neither the IP nor the visitor's
 * coordinates are returned, logged or stored.
 */
class WelcomeNearbyController extends Controller
{
    private const EARTH_KM = 6371;

    // GET /api/welcome/nearby
    public function __invoke(Request $request, Locator $locator): JsonResponse
    {
        // Targeting off (or the screen switched off): no lookup at all, so the
        // visitor's IP is never even handed to the locator.
        $settings = WelcomeSettings::get();
        if (($settings['geo']['enabled'] ?? false) !== true
            || ! WebsiteModule::where('slug', 'welcome')->where('enabled', true)->exists()) {
            return response()->json(['located' => false, 'concert_ids' => []]);
        }

        $point = $locator->locate((string) $request->ip());
        if ($point === null) {
            return response()->json(['located' => false, 'concert_ids' => []]);
        }

        $radius = $settings['geo']['radius_km'];

        $ids = Concert::query()
            ->whereDate('date', '>=', now()->toDateString())
            ->whereHas('venue', fn ($q) => $q->whereNotNull('latitude')->whereNotNull('longitude'))
            ->with('venue:id,latitude,longitude')
            ->orderBy('date')->orderBy('id')
            ->get(['id', 'date', 'venue_id'])
            ->filter(fn ($c) => $this->km($point->lat, $point->lng, (float) $c->venue->latitude, (float) $c->venue->longitude) <= $radius)
            ->pluck('id')->values()->all();

        return response()->json(['located' => true, 'concert_ids' => $ids]);
    }

    private function km(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * self::EARTH_KM * asin(min(1, sqrt($a)));
    }
}
