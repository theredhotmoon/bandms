<?php

namespace App\Http\Controllers;

use App\Http\Requests\TechRiderRequest;
use App\Http\Resources\TechRiderResource;
use App\Http\Resources\TechRiderSummaryResource;
use App\Models\BandProfile;
use App\Models\TechRider;
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
        $riders = TechRider::where('profile_id', $this->profileId())
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

        return new TechRiderResource($rider->load('concert.venue'));
    }

    /** Public endpoint — no auth required, accessed via QR code. */
    public function showByToken(string $token): TechRiderResource
    {
        $rider = TechRider::with('concert.venue')->where('public_token', $token)->firstOrFail();

        return new TechRiderResource($rider);
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

        return new TechRiderResource($rider->load('concert.venue'));
    }

    public function show(TechRider $techRider): TechRiderResource
    {
        return new TechRiderResource($techRider->load('concert.venue'));
    }

    public function update(TechRiderRequest $request, TechRider $techRider): TechRiderResource
    {
        $data = $request->validated();

        if (!empty($data['is_active'])) {
            $this->deactivateOthers($techRider->id);
        }

        $techRider->update($data);

        return new TechRiderResource($techRider->fresh()->load('concert.venue'));
    }

    public function activate(TechRider $techRider): TechRiderResource
    {
        $this->deactivateOthers($techRider->id);
        $techRider->update(['is_active' => true]);

        return new TechRiderResource($techRider->fresh()->load('concert.venue'));
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
