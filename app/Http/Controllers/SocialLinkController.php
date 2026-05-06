<?php

namespace App\Http\Controllers;

use App\Http\Resources\SocialLinkResource;
use App\Models\Band;
use App\Models\SocialLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class SocialLinkController extends Controller
{
    public function index(Band $band): ResourceCollection
    {
        $links = $band->socialLinks()->orderBy('platform')->get();

        return SocialLinkResource::collection($links);
    }

    public function store(Request $request, Band $band): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link = $band->socialLinks()->create($data);

        return new SocialLinkResource($link);
    }

    public function update(Request $request, Band $band, SocialLink $link): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link->update($data);

        return new SocialLinkResource($link);
    }

    public function destroy(Band $band, SocialLink $link): \Illuminate\Http\Response
    {
        $link->delete();

        return response()->noContent();
    }
}
