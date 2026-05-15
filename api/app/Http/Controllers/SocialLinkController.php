<?php

namespace App\Http\Controllers;

use App\Http\Resources\SocialLinkResource;
use App\Models\BandProfile;
use App\Models\SocialLink;
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
        $links = $this->profile()->socialLinks()->orderBy('platform')->get();

        return SocialLinkResource::collection($links);
    }

    public function store(Request $request): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link = $this->profile()->socialLinks()->create($data);

        return new SocialLinkResource($link);
    }

    public function update(Request $request, SocialLink $link): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link->update($data);

        return new SocialLinkResource($link);
    }

    public function destroy(SocialLink $link): \Illuminate\Http\Response
    {
        $link->delete();

        return response()->noContent();
    }
}
