<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberResource;
use App\Models\BandMember;
use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BandMemberController extends Controller
{
    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    public function index(): AnonymousResourceCollection
    {
        $members = $this->profile()
            ->members()
            ->with(['socialLinks', 'instruments', 'setups'])
            ->orderBy('is_current', 'desc')
            ->orderBy('sort_order')
            ->orderBy('joined_at')
            ->get();

        return BandMemberResource::collection($members);
    }

    public function store(Request $request): BandMemberResource
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
            'calendar_url'            => ['nullable', 'url', 'max:1000'],
            'login_email'             => ['nullable', 'email', 'max:255', 'unique:band_members,login_email'],
            'can_login'               => ['boolean'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
            'instrument_ids'          => ['nullable', 'array'],
            'instrument_ids.*'        => ['integer', 'exists:instruments,id'],
        ]);

        $profile = $this->profile();
        $member = $profile->members()->create($data);

        foreach ($request->input('social_links', []) as $link) {
            $member->socialLinks()->create([
                'profile_id' => $profile->id,
                'platform'   => $link['platform'],
                'url'        => $link['url'],
            ]);
        }

        $member->instruments()->sync($request->input('instrument_ids', []));
        $member->load(['socialLinks', 'instruments']);

        return new BandMemberResource($member);
    }

    public function update(Request $request, BandMember $member): BandMemberResource
    {
        /** @var \App\Models\User $authUser */
        $authUser = $request->user();

        // Members may only edit their own record; admins can edit anyone.
        if ($authUser->isMember() && $authUser->band_member_id !== $member->id) {
            abort(403);
        }

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
            'calendar_url'            => ['nullable', 'url', 'max:1000'],
            'login_email'             => ['nullable', 'email', 'max:255', \Illuminate\Validation\Rule::unique('band_members', 'login_email')->ignore($member->id)],
            'can_login'               => ['boolean'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
            'instrument_ids'          => ['nullable', 'array'],
            'instrument_ids.*'        => ['integer', 'exists:instruments,id'],
        ]);

        $member->update($data);

        $member->socialLinks()->delete();
        foreach ($request->input('social_links', []) as $link) {
            $member->socialLinks()->create([
                'profile_id' => $member->profile_id,
                'platform'   => $link['platform'],
                'url'        => $link['url'],
            ]);
        }

        $member->instruments()->sync($request->input('instrument_ids', []));
        $member->load(['socialLinks', 'instruments']);

        return new BandMemberResource($member);
    }

    public function destroy(BandMember $member): JsonResponse
    {
        $member->delete();

        return response()->json(null, 204);
    }
}
