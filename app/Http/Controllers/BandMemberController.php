<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberResource;
use App\Models\Band;
use App\Models\BandMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BandMemberController extends Controller
{
    public function index(Band $band): AnonymousResourceCollection
    {
        $members = $band->members()
            ->with('socialLinks')
            ->orderBy('is_current', 'desc')
            ->orderBy('sort_order')
            ->orderBy('joined_at')
            ->get();

        return BandMemberResource::collection($members);
    }

    public function store(Request $request, Band $band): BandMemberResource
    {
        $data = $request->validate([
            'first_name'              => ['required', 'string', 'max:255'],
            'last_name'               => ['required', 'string', 'max:255'],
            'bio'                     => ['nullable', 'string'],
            'photo'                   => ['nullable', 'string', 'max:1000'],
            'role'                    => ['nullable', 'string', 'max:255'],
            'is_current'              => ['boolean'],
            'joined_at'               => ['nullable', 'date'],
            'quit_at'                 => ['nullable', 'date', 'after_or_equal:joined_at'],
            'sort_order'              => ['integer', 'min:0'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
        ]);

        $member = $band->members()->create($data);

        foreach ($request->input('social_links', []) as $link) {
            $member->socialLinks()->create([
                'band_id'  => $band->id,
                'platform' => $link['platform'],
                'url'      => $link['url'],
            ]);
        }

        $member->load('socialLinks');

        return new BandMemberResource($member);
    }

    public function update(Request $request, Band $band, BandMember $member): BandMemberResource
    {
        $data = $request->validate([
            'first_name'              => ['sometimes', 'required', 'string', 'max:255'],
            'last_name'               => ['sometimes', 'required', 'string', 'max:255'],
            'bio'                     => ['nullable', 'string'],
            'photo'                   => ['nullable', 'string', 'max:1000'],
            'role'                    => ['nullable', 'string', 'max:255'],
            'is_current'              => ['boolean'],
            'joined_at'               => ['nullable', 'date'],
            'quit_at'                 => ['nullable', 'date', 'after_or_equal:joined_at'],
            'sort_order'              => ['integer', 'min:0'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
        ]);

        $member->update($data);

        $member->socialLinks()->delete();
        foreach ($request->input('social_links', []) as $link) {
            $member->socialLinks()->create([
                'band_id'  => $band->id,
                'platform' => $link['platform'],
                'url'      => $link['url'],
            ]);
        }

        $member->load('socialLinks');

        return new BandMemberResource($member);
    }

    public function destroy(Band $band, BandMember $member): JsonResponse
    {
        $member->delete();

        return response()->json(null, 204);
    }
}
