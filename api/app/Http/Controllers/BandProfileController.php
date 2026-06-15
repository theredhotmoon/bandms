<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandProfileResource;
use App\Models\BandProfile;
use App\Models\EpkVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Services\EpkSnapshotBuilder;

class BandProfileController extends Controller
{
    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    public function show(): BandProfileResource
    {
        return new BandProfileResource(
            $this->profile()->load(['members', 'socialLinks', 'logos', 'defaultLogo'])
        );
    }

    public function update(Request $request): BandProfileResource
    {
        $data = $request->validate([
            'name'                     => ['sometimes', 'required', 'string', 'max:255'],
            'bio_short'                => ['nullable', function ($attribute, $value, $fail) {
                if (is_string($value) && mb_strlen($value) > 280) {
                    $fail("The {$attribute} may not be greater than 280 characters.");
                }
            }],
            'bio_short.en'             => ['nullable', 'string', 'max:280'],
            'bio_short.pl'             => ['nullable', 'string', 'max:280'],
            'bio_medium'               => ['nullable'],
            'bio_medium.en'            => ['nullable', 'string'],
            'bio_medium.pl'            => ['nullable', 'string'],
            'bio_long'                 => ['nullable'],
            'bio_long.en'              => ['nullable', 'string'],
            'bio_long.pl'              => ['nullable', 'string'],
            'bio_full'                 => ['nullable'],
            'bio_full.en'              => ['nullable', 'string'],
            'bio_full.pl'              => ['nullable', 'string'],
            'formation_year'           => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'hometown'                 => ['nullable', 'string', 'max:255'],
            'genres'                   => ['nullable', 'string', 'max:500'],
            'comparable_artists'       => ['nullable', 'string', 'max:500'],
            'booking_email'            => ['nullable', 'email', 'max:255'],
            'press_email'              => ['nullable', 'email', 'max:255'],
            'tech_contact_phone'       => ['nullable', 'string', 'max:50'],
            'tech_contact_email'       => ['nullable', 'email', 'max:255'],
            'tech_rider_notes'         => ['nullable', 'string'],
            'artistic_statement'       => ['nullable'],
            'artistic_statement.en'    => ['nullable', 'string'],
            'artistic_statement.pl'    => ['nullable', 'string'],
            'stat_spotify_monthly'     => ['nullable', 'integer', 'min:0'],
            'stat_instagram_followers' => ['nullable', 'integer', 'min:0'],
            'stat_tiktok_followers'    => ['nullable', 'integer', 'min:0'],
            'stat_youtube_subscribers' => ['nullable', 'integer', 'min:0'],
            'stat_facebook_followers'  => ['nullable', 'integer', 'min:0'],
            'epk_release_id'           => ['nullable', 'integer', 'exists:releases,id'],
            'epk_album_id'             => ['nullable', 'integer', 'exists:albums,id'],
            'career_level'             => ['nullable', 'integer', 'min:1', 'max:4'],
            // Context-specific logo pins (must belong to this profile)
            'epk_logo_id'              => ['nullable', 'integer', 'exists:band_logos,id'],
            'tech_rider_logo_id'       => ['nullable', 'integer', 'exists:band_logos,id'],
            'website_logo_id'          => ['nullable', 'integer', 'exists:band_logos,id'],
        ]);

        $profile = $this->profile();
        $profile->update($data);

        return new BandProfileResource($profile->load(['members', 'socialLinks', 'logos', 'defaultLogo']));
    }

    public function uploadTechRider(Request $request): BandProfileResource
    {
        $request->validate(['file' => 'required|file|mimes:pdf|max:10240']);

        $profile = $this->profile();
        if ($profile->tech_rider_path) {
            Storage::disk('public')->delete($profile->tech_rider_path);
        }

        $path = $request->file('file')->store('epk', 'public');
        $profile->update(['tech_rider_path' => $path]);

        return new BandProfileResource($profile->load(['members', 'socialLinks']));
    }

    public function destroyTechRider(): BandProfileResource
    {
        $profile = $this->profile();
        if ($profile->tech_rider_path) {
            Storage::disk('public')->delete($profile->tech_rider_path);
            $profile->update(['tech_rider_path' => null]);
        }

        return new BandProfileResource($profile->load(['members', 'socialLinks']));
    }

    public function uploadStagePlot(Request $request): BandProfileResource
    {
        $request->validate(['file' => 'required|image|max:4096']);

        $profile = $this->profile();
        if ($profile->stage_plot_path) {
            Storage::disk('public')->delete($profile->stage_plot_path);
        }

        $path = $request->file('file')->store('epk', 'public');
        $profile->update(['stage_plot_path' => $path]);

        return new BandProfileResource($profile->load(['members', 'socialLinks']));
    }

    public function destroyStagePlot(): BandProfileResource
    {
        $profile = $this->profile();
        if ($profile->stage_plot_path) {
            Storage::disk('public')->delete($profile->stage_plot_path);
            $profile->update(['stage_plot_path' => null]);
        }

        return new BandProfileResource($profile->load(['members', 'socialLinks']));
    }

    public function showEpk(): JsonResponse
    {
        $published = EpkVersion::where('status', 'published')->latest('published_at')->first();

        if ($published) {
            return response()->json(['data' => $published->snapshot]);
        }

        return response()->json(['data' => EpkSnapshotBuilder::build()]);
    }
}
