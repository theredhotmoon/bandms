<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberResource;
use App\Models\Album;
use App\Models\BandMember;
use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use App\Support\SiteRebuild;

class BandMemberController extends Controller
{
    /** Mirrors DefaultGearItemType in @bandms/rider-core. */
    private const GEAR_TYPES = [
        'microphone', 'amp_head', 'amp_combo', 'cabinet', 'di_box', 'keyboard',
        'drum_kit', 'drum_hardware', 'pedal_board', 'wireless_system', 'other',
    ];

    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    public function index(): AnonymousResourceCollection
    {
        $members = $this->profile()
            ->members()
            ->with([
                'socialLinks', 'instruments', 'setups', 'mainInstrument',
                // Only photos the public can see: an album without a
                // published_at is a draft, the same rule the gallery applies.
                // Featured (press-kit ★) photos lead, then the newest shoot,
                // then each album's own order. A subquery, not a join: a join
                // needs a select('photos.*'), which would drop the pivot column
                // the eager load matches members on.
                'photos' => fn ($q) => $q
                    ->whereHas('album', fn ($a) => $a->whereNotNull('published_at'))
                    // A row with no file would render as a broken image.
                    ->whereNotNull('photos.image')
                    ->orderByDesc('photos.epk_featured')
                    ->orderByDesc(Album::select('taken_at')->whereColumn('albums.id', 'photos.album_id'))
                    ->orderByDesc('photos.album_id')
                    ->orderBy('photos.sort_order'),
                // Published news only, newest first — the same rule as /posts.
                'posts' => fn ($q) => $q->published()->orderByDesc('posts.published_at'),
                'concerts' => fn ($q) => $q->orderByDesc('concerts.date'),
                'clips' => fn ($q) => $q->orderByDesc('clips.recorded_on')->orderByDesc('clips.id'),
            ])
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
            'main_instrument_id'      => ['nullable', 'integer', 'exists:instruments,id'],
            'default_gear'            => ['nullable', 'array'],
            // Each item's fields are typed: the public member page prints them,
            // and a non-string there would fail the whole static build.
            // Every field the admin sends needs a rule: Laravel drops array keys
            // without one from the validated data. The admin keys, removes and
            // edits gear items by `id`, so losing it broke all three.
            'default_gear.*.id'          => ['nullable', 'string', 'max:64'],
            'default_gear.*.type'        => ['required', 'string', 'in:' . implode(',', self::GEAR_TYPES)],
            'default_gear.*.label'       => ['nullable', 'string', 'max:255'],
            'default_gear.*.brand_model' => ['nullable', 'string', 'max:255'],
            'default_gear.*.own_gear'    => ['boolean'],
            'default_gear.*.notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        $profile = $this->profile();
        $member = $profile->members()->create($data);

        foreach (array_values($request->input('social_links', [])) as $index => $link) {
            $member->socialLinks()->create([
                'profile_id' => $profile->id,
                'platform'   => $link['platform'],
                'url'        => $link['url'],
                'position'   => $index,
            ]);
        }

        $member->instruments()->sync($request->input('instrument_ids', []));
        $member->load(['socialLinks', 'instruments', 'mainInstrument']);

        SiteRebuild::markDirty('band-members');

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
            'main_instrument_id'      => ['nullable', 'integer', 'exists:instruments,id'],
            'default_gear'            => ['nullable', 'array'],
            // Each item's fields are typed: the public member page prints them,
            // and a non-string there would fail the whole static build.
            // Every field the admin sends needs a rule: Laravel drops array keys
            // without one from the validated data. The admin keys, removes and
            // edits gear items by `id`, so losing it broke all three.
            'default_gear.*.id'          => ['nullable', 'string', 'max:64'],
            'default_gear.*.type'        => ['required', 'string', 'in:' . implode(',', self::GEAR_TYPES)],
            'default_gear.*.label'       => ['nullable', 'string', 'max:255'],
            'default_gear.*.brand_model' => ['nullable', 'string', 'max:255'],
            'default_gear.*.own_gear'    => ['boolean'],
            'default_gear.*.notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        $member->update($data);

        $member->socialLinks()->delete();
        foreach (array_values($request->input('social_links', [])) as $index => $link) {
            $member->socialLinks()->create([
                'profile_id' => $member->profile_id,
                'platform'   => $link['platform'],
                'url'        => $link['url'],
                'position'   => $index,
            ]);
        }

        $member->instruments()->sync($request->input('instrument_ids', []));

        SiteRebuild::markDirty('band-members');

        $member->load(['socialLinks', 'instruments', 'mainInstrument']);

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

        SiteRebuild::markDirty('band-members');

        $member->load(['socialLinks', 'instruments', 'mainInstrument']);

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

        SiteRebuild::markDirty('band-members');

        return response()->json(['ok' => true]);
    }

    public function destroy(BandMember $member): JsonResponse
    {
        $member->delete();

        SiteRebuild::markDirty('band-members');

        return response()->json(null, 204);
    }
}
