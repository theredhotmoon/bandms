<?php

namespace App\Http\Controllers;

use App\Support\Geo\Locator;
use App\Support\SiteRebuild;
use App\Support\WelcomeSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin editor for the welcome screen. The screen is baked into the public
 * build, so every write marks `website-modules` dirty.
 */
class WelcomeSettingsController extends Controller
{
    // GET /api/admin/welcome-settings
    public function show(): JsonResponse
    {
        return $this->respond();
    }

    // PUT /api/admin/welcome-settings
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'blocks'           => 'present|array',
            'blocks.*'         => ['string', Rule::in(WelcomeSettings::BLOCKS)],
            'concert_count'    => 'required|integer|min:1|max:3',
            'frequency'        => ['required', Rule::in(['interval', 'once'])],
            'reshow_days'      => 'required|integer|min:1|max:365',
            'geo'              => 'required|array',
            'geo.enabled'      => 'required|boolean',
            'geo.radius_km'    => 'required|integer|min:10|max:1000',
            'geo.far_visitors' => ['required', Rule::in(['hide_gigs', 'no_screen'])],
        ]);

        // The validator accepts "3", 1 and "1"; normalise() wants real ints and
        // bools, and would otherwise save the defaults over them silently.
        $data['concert_count'] = (int) $data['concert_count'];
        $data['reshow_days'] = (int) $data['reshow_days'];
        $data['geo']['radius_km'] = (int) $data['geo']['radius_km'];
        $data['geo']['enabled'] = filter_var($data['geo']['enabled'], FILTER_VALIDATE_BOOLEAN);

        WelcomeSettings::save($data);
        SiteRebuild::markDirty('website-modules');

        return $this->respond();
    }

    // POST /api/admin/welcome-settings/campaign
    public function campaign(): JsonResponse
    {
        WelcomeSettings::stampCampaign();
        SiteRebuild::markDirty('website-modules');

        return $this->respond();
    }

    private function respond(): JsonResponse
    {
        return response()->json(['data' => WelcomeSettings::get() + [
            'geo_available' => app(Locator::class)->available(),
        ]]);
    }
}
