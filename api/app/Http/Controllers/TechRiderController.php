<?php

namespace App\Http\Controllers;

use App\Http\Requests\TechRiderRequest;
use App\Http\Resources\TechRiderResource;
use App\Http\Resources\TechRiderSummaryResource;
use App\Http\Resources\TechRiderVersionResource;
use App\Models\BandProfile;
use App\Models\TechRider;
use App\Models\TechRiderVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
