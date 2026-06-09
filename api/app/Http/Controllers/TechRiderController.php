<?php

namespace App\Http\Controllers;

use App\Http\Resources\TechRiderResource;
use App\Http\Resources\TechRiderSummaryResource;
use App\Models\BandProfile;
use App\Models\TechRider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TechRiderController extends Controller
{
    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    public function index(): AnonymousResourceCollection
    {
        $riders = TechRider::where('profile_id', 1)
            ->orderByDesc('is_active')
            ->orderByDesc('updated_at')
            ->get();

        return TechRiderSummaryResource::collection($riders);
    }

    public function showActive(): TechRiderResource
    {
        $rider = TechRider::where('profile_id', 1)->where('is_active', true)->firstOrFail();
        return new TechRiderResource($rider->load('concert.venue'));
    }

    /** Public endpoint — no auth required, accessed via QR code. */
    public function showByToken(string $token): TechRiderResource
    {
        $rider = TechRider::with('concert.venue')->where('public_token', $token)->firstOrFail();
        return new TechRiderResource($rider);
    }

    public function store(Request $request): TechRiderResource
    {
        $data = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'is_active'       => ['boolean'],
            'concert_id'      => ['nullable', 'integer', 'exists:concerts,id'],
            'gig_lineup'      => ['nullable', 'array'],
            'stage_plot_data' => ['nullable', 'array'],
            'inputs'          => ['nullable', 'array'],
            'monitors'        => ['nullable', 'array'],
            'backline'        => ['nullable', 'array'],
            'pa_foh'          => ['nullable', 'array'],
            'power'           => ['nullable', 'array'],
            'rf_wireless'     => ['nullable', 'array'],
        ]);

        $data['profile_id'] = 1;
        $data['is_active'] = $data['is_active'] ?? false;

        if ($data['is_active']) {
            TechRider::where('profile_id', 1)->update(['is_active' => false]);
        }

        $rider = TechRider::create($data);

        return new TechRiderResource($rider->load('concert.venue'));
    }

    public function show(TechRider $techRider): TechRiderResource
    {
        return new TechRiderResource($techRider->load('concert.venue'));
    }

    public function update(Request $request, TechRider $techRider): TechRiderResource
    {
        $data = $request->validate([
            'name'            => ['sometimes', 'required', 'string', 'max:255'],
            'is_active'       => ['boolean'],
            'concert_id'      => ['nullable', 'integer', 'exists:concerts,id'],
            'gig_lineup'      => ['nullable', 'array'],
            'stage_plot_data' => ['nullable', 'array'],
            'inputs'          => ['nullable', 'array'],
            'monitors'        => ['nullable', 'array'],
            'backline'        => ['nullable', 'array'],
            'pa_foh'          => ['nullable', 'array'],
            'power'           => ['nullable', 'array'],
            'rf_wireless'     => ['nullable', 'array'],
        ]);

        if (isset($data['is_active']) && $data['is_active']) {
            TechRider::where('profile_id', 1)
                ->where('id', '!=', $techRider->id)
                ->update(['is_active' => false]);
        }

        $techRider->update($data);

        return new TechRiderResource($techRider->fresh()->load('concert.venue'));
    }

    public function activate(TechRider $techRider): TechRiderResource
    {
        TechRider::where('profile_id', 1)
            ->where('id', '!=', $techRider->id)
            ->update(['is_active' => false]);

        $techRider->update(['is_active' => true]);

        return new TechRiderResource($techRider->fresh()->load('concert.venue'));
    }

    public function destroy(TechRider $techRider): JsonResponse
    {
        $techRider->delete();
        return response()->json(null, 204);
    }
}
