<?php

namespace App\Http\Controllers;

use App\Http\Requests\TechRiderRequest;
use App\Http\Resources\TechRiderResource;
use App\Http\Resources\TechRiderSummaryResource;
use App\Http\Resources\TechRiderVersionResource;
use App\Models\BandMember;
use App\Models\BandProfile;
use App\Models\Concert;
use App\Models\TechRider;
use App\Models\TechRiderVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class TechRiderController extends Controller
{
    /** The profile every rider belongs to. Single-profile today, resolved in one place. */
    private function profileId(): int
    {
        return BandProfile::query()->value('id') ?? 1;
    }

    public function index(): AnonymousResourceCollection
    {
        $riders = TechRider::with('publishedVersion')
            ->where('profile_id', $this->profileId())
            ->orderByDesc('is_active')
            ->orderByDesc('updated_at')
            ->get();

        return TechRiderSummaryResource::collection($riders);
    }

    public function showActive(): TechRiderResource
    {
        $rider = TechRider::where('profile_id', $this->profileId())
            ->where('is_active', true)
            ->firstOrFail();

        return new TechRiderResource($rider->load('concert.venue', 'publishedVersion'));
    }

    /**
     * Public endpoint — no auth required, accessed via QR code.
     *
     * Serves a published *version*, never the live rider. A rider under edit
     * changes every time a musician updates their saved rig; a promoter holding
     * the link must keep seeing the sheet they were sent.
     *
     * Two kinds of token arrive here:
     *  - the rider's own token, printed on QR codes, which follows the band
     *    forward and always serves whichever version is currently published;
     *  - a version's token, which serves that exact version for good, so a
     *    corrected rider can be re-sent without breaking the earlier link.
     */
    public function showByToken(string $token): JsonResponse
    {
        $version = TechRiderVersion::where('public_token', $token)->first();

        if (! $version) {
            $rider = TechRider::where('public_token', $token)->firstOrFail();
            $version = $rider->publishedVersion;

            abort_if($version === null, 404, 'This rider has not been published yet.');
        }

        return response()->json([
            'data' => array_merge($version->snapshot ?? [], [
                'version' => (new TechRiderVersionResource($version))->resolve(request()),
            ]),
        ]);
    }

    public function store(TechRiderRequest $request): TechRiderResource
    {
        $data = $request->validated();
        $data['profile_id'] = $this->profileId();
        $data['is_active']  = $data['is_active'] ?? false;

        if ($data['is_active']) {
            $this->deactivateOthers();
        }

        $rider = TechRider::create($data);

        return new TechRiderResource($rider->load('concert.venue', 'publishedVersion'));
    }

    public function show(TechRider $techRider): TechRiderResource
    {
        return new TechRiderResource($techRider->load('concert.venue', 'publishedVersion'));
    }

    public function update(TechRiderRequest $request, TechRider $techRider): TechRiderResource
    {
        $data = $request->validated();

        if (!empty($data['is_active'])) {
            $this->deactivateOthers($techRider->id);
        }

        $techRider->update($data);

        return new TechRiderResource($techRider->fresh()->load('concert.venue', 'publishedVersion'));
    }

    /**
     * Copy a rider so a variant can start from a working one.
     *
     * A festival rider is usually a club rider plus a few channels; without
     * this, deriving one means rebuilding a stage plot by hand. Everything that
     * describes the gig is copied and everything that identifies *this* rider is
     * not: the copy gets its own public token, starts inactive, and carries no
     * versions — it has never been sent, and claiming otherwise would be a lie
     * to whoever reads the history next.
     */
    public function duplicate(TechRider $techRider): TechRiderResource
    {
        $copy = $techRider->replicate([
            'public_token', 'is_active', 'created_at', 'updated_at',
        ]);

        $copy->name = Str::limit($techRider->name, 240, '') . ' (copy)';
        $copy->is_active = false;
        // A copy is a template for a different night; carrying the concert over
        // would silently give one gig two riders.
        $copy->concert_id = null;
        $copy->save();

        return new TechRiderResource($copy->load('concert.venue', 'publishedVersion'));
    }

    /**
     * Start a rider for a concert, pre-filled with tonight's lineup.
     *
     * The point is that the tedious part — naming it, linking the concert,
     * listing who is playing — is the part that can be inferred. What cannot be
     * inferred is the stage plot, which is where the user picks up.
     */
    public function storeForConcert(Concert $concert): TechRiderResource|JsonResponse
    {
        $existing = TechRider::where('profile_id', $this->profileId())
            ->where('concert_id', $concert->id)
            ->first();

        if ($existing) {
            return response()->json([
                'message'         => 'This concert already has a rider.',
                'tech_rider_id'   => $existing->id,
                'tech_rider_name' => $existing->name,
            ], 409);
        }

        $concert->loadMissing('venue');

        $rider = TechRider::create([
            'profile_id' => $this->profileId(),
            'name'       => $this->riderNameFor($concert),
            'is_active'  => false,
            'concert_id' => $concert->id,
            'gig_lineup' => [
                // Everyone currently in the band is assumed available; the
                // editor is where you mark who is not.
                'regular_members' => BandMember::where('profile_id', $this->profileId())
                    ->where('is_current', true)
                    ->orderBy('sort_order')
                    ->get()
                    ->map(fn (BandMember $m) => [
                        'band_member_id' => $m->id,
                        'is_available'   => true,
                    ])
                    ->values()
                    ->all(),
                'temp_musicians' => [],
            ],
        ]);

        return new TechRiderResource($rider->load('concert.venue', 'publishedVersion'));
    }

    /** "Pod Minogą — 2026-09-12", or the date alone when the venue is unknown. */
    private function riderNameFor(Concert $concert): string
    {
        $date  = $concert->date?->format('Y-m-d') ?? 'TBC';
        $venue = $concert->venue?->name;

        return Str::limit($venue ? "{$venue} — {$date}" : "Concert — {$date}", 255, '');
    }

    public function activate(TechRider $techRider): TechRiderResource
    {
        $this->deactivateOthers($techRider->id);
        $techRider->update(['is_active' => true]);

        return new TechRiderResource($techRider->fresh()->load('concert.venue', 'publishedVersion'));
    }

    public function destroy(TechRider $techRider): JsonResponse
    {
        $techRider->delete();

        return response()->json(null, 204);
    }

    private function deactivateOthers(?int $exceptId = null): void
    {
        TechRider::where('profile_id', $this->profileId())
            ->when($exceptId !== null, fn ($q) => $q->where('id', '!=', $exceptId))
            ->update(['is_active' => false]);
    }
}
