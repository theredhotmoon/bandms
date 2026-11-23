<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberResource;
use App\Models\Album;
use App\Models\BandMember;
use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
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
                'releases' => fn ($q) => $q->orderByDesc('releases.release_date')->orderByDesc('releases.id'),
                // Every article: published_at is the article's own date, not a
                // draft flag — the Press page lists undated ones too.
                'pressReleases' => fn ($q) => $q->orderByDesc('press_releases.published_at')->orderByDesc('press_releases.id'),
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
            // A member may switch their own page off; not stripped below.
            'public_page'             => ['boolean'],
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

        $this->ensureHasPart($request, null);

        $profile = $this->profile();
        $member = DB::transaction(function () use ($profile, $data, $request) {
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

            return $member;
        });
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
            // A member may switch their own page off; not stripped below.
            'public_page'             => ['boolean'],
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

        // `photo` too: the upload is admin-only, and an older admin bundle sent
        // `photo: null` beside a file the member could never upload.
        if ($authUser->isMember()) {
            unset($data['can_login'], $data['login_email'], $data['is_current'], $data['sort_order'], $data['joined_at'], $data['quit_at'], $data['photo']);
        }

        $this->ensureHasPart($request, $member);

        DB::transaction(function () use ($member, $data, $request) {
            $member->update($data);

            // Links and instruments are replaced only when sent: defaulting a
            // missing key to [] made every partial update a wipe of both.
            if ($request->has('social_links')) {
                $member->socialLinks()->delete();
                foreach (array_values($request->input('social_links') ?? []) as $index => $link) {
                    $member->socialLinks()->create([
                        'profile_id' => $member->profile_id,
                        'platform'   => $link['platform'],
                        'url'        => $link['url'],
                        'position'   => $index,
                    ]);
                }
            }

            if ($request->has('instrument_ids')) {
                $member->instruments()->sync($request->input('instrument_ids') ?? []);
            }
        });

        SiteRebuild::markDirty('band-members');

        $member->load(['socialLinks', 'instruments', 'mainInstrument']);

        return new BandMemberResource($member);
    }

    /**
     * A band member plays something or has some other part in the band — a
     * member with neither is never right, so it is refused like any other
     * invalid field. Reported under `instrument_ids`, where the form shows it.
     *
     * `$member` is null on create. On update, a field the request did not send
     * keeps its stored value: `$request->has(...)` tells you which, and the
     * member holds the rest.
     *
     * The main instrument counts on its own. It is a column beside the
     * `instrument_ids` pivot, and the form keeps the two in step, but an API
     * call or a row from before that may set only the column.
     */
    private function ensureHasPart(Request $request, ?BandMember $member): void
    {
        // An update that touches none of these cannot break the rule, so it is
        // not judged: a member stored before the rule existed must still be
        // able to change their bio through a partial update. (The admin form
        // and My Profile always send them, so they are judged.)
        if ($member && ! $request->hasAny(['role', 'instrument_ids', 'main_instrument_id'])) {
            return;
        }

        $hasRole = $request->has('role')
            ? $request->filled('role')
            : filled($member?->role);
        $hasInstrument = $request->has('instrument_ids')
            ? count($request->input('instrument_ids') ?? []) > 0
            : (bool) $member?->instruments()->exists();
        $hasMain = $request->has('main_instrument_id')
            ? $request->filled('main_instrument_id')
            : filled($member?->main_instrument_id);

        if (! $hasRole && ! $hasInstrument && ! $hasMain) {
            throw ValidationException::withMessages(['instrument_ids' => __('api.member_needs_part')]);
        }
    }

    public function uploadPhoto(Request $request, BandMember $member): BandMemberResource
    {
        $request->validate(['photo' => 'required|image|mimes:jpg,jpeg,png,gif,webp|max:4096']);

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
