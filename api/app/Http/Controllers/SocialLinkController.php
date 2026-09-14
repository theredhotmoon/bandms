<?php

namespace App\Http\Controllers;

use App\Http\Resources\SocialLinkResource;
use App\Models\BandProfile;
use App\Models\SocialLink;
use App\Support\SiteRebuild;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class SocialLinkController extends Controller
{
    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    public function index(): ResourceCollection
    {
        $links = $this->profile()->socialLinks()->orderBy('position')->get();

        return SocialLinkResource::collection($links);
    }

    public function store(Request $request): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link = $this->profile()->socialLinks()->create($data);

        SiteRebuild::markDirty('band-profile');

        return new SocialLinkResource($link);
    }

    public function update(Request $request, SocialLink $link): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link->update($data);

        if ($area = $this->dirtyArea($link)) {
            SiteRebuild::markDirty($area);
        }

        return new SocialLinkResource($link);
    }

    public function destroy(SocialLink $link): \Illuminate\Http\Response
    {
        $area = $this->dirtyArea($link);
        $link->delete();

        if ($area) {
            SiteRebuild::markDirty($area);
        }

        return response()->noContent();
    }

    public function sync(Request $request): ResourceCollection
    {
        $data = $request->validate([
            'links'            => ['nullable', 'array'],
            'links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'links.*.url'      => ['required', 'url', 'max:500'],
        ]);

        $profile = $this->profile();
        $profile->socialLinks()->delete();

        foreach ($data['links'] ?? [] as $index => $link) {
            $profile->socialLinks()->create(array_merge($link, ['position' => $index]));
        }

        SiteRebuild::markDirty('band-profile');

        return SocialLinkResource::collection(
            $profile->socialLinks()->orderBy('position')->get()
        );
    }

    /**
     * Which area a social link's write affects, based on its owner column —
     * not on how this controller reached it, since update()/destroy() act on
     * whichever SocialLink the route binds, regardless of owner.
     */
    private function dirtyArea(SocialLink $link): ?string
    {
        return match (true) {
            $link->profile_id !== null => 'band-profile',
            $link->venue_id !== null   => 'venues',
            default => null, // member_id/author_id owners aren't baked publicly
        };
    }
}
