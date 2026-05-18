<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberResource;
use App\Models\BandMember;
use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

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
            'nickname'                => ['nullable', 'string', 'max:255'],
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
            'default_gear'            => ['nullable', 'array'],
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
            'nickname'                => ['nullable', 'string', 'max:255'],
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
            'default_gear'            => ['nullable', 'array'],
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

    public function uploadPhoto(Request $request, BandMember $member): BandMemberResource
    {
        $request->validate(['photo' => 'required|image|max:4096']);

        // Delete previous locally-stored photo
        if ($member->photo) {
            $localPrefix = Storage::disk('public')->url('');
            if (str_starts_with($member->photo, $localPrefix)) {
                $storedPath = substr($member->photo, strlen($localPrefix));
                Storage::disk('public')->delete($storedPath);
            }
        }

        $path = $request->file('photo')->store('members', 'public');
        $member->update(['photo' => '/storage/' . $path]);
        $member->load(['socialLinks', 'instruments']);

        return new BandMemberResource($member);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        $profileId = $this->profile()->id;
        foreach ($data['ids'] as $index => $id) {
            BandMember::where('id', $id)
                ->where('profile_id', $profileId)
                ->update(['sort_order' => $index]);
        }

        return response()->json(['ok' => true]);
    }

    public function destroy(BandMember $member): JsonResponse
    {
        $member->delete();

        return response()->json(null, 204);
    }
}
