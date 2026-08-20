<?php

namespace App\Http\Controllers;

use App\Http\Requests\BandMemberSetupRequest;
use App\Http\Resources\BandMemberSetupResource;
use App\Http\Resources\BandMemberSetupSummaryResource;
use App\Models\BandMember;
use App\Models\BandMemberSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BandMemberSetupController extends Controller
{
    // ── Nested: /band-profile/members/{member}/setups ─────────────────────────

    private function authorizeForMember(BandMember $member): void
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        if ($user->isMember() && $user->band_member_id !== $member->id) {
            abort(403);
        }
    }

    public function index(BandMember $member): AnonymousResourceCollection
    {
        $this->authorizeForMember($member);
        $setups = $member->setups()->with('instrument')->orderBy('updated_at', 'desc')->get();

        return BandMemberSetupSummaryResource::collection($setups);
    }

    public function store(BandMemberSetupRequest $request, BandMember $member): BandMemberSetupResource
    {
        $this->authorizeForMember($member);
        $data = $request->validated();
        if (!empty($data['is_default'])) {
            $member->setups()->update(['is_default' => false]);
        }
        $setup = $member->setups()->create($data);

        return new BandMemberSetupResource($setup);
    }

    public function show(BandMember $member, BandMemberSetup $setup): BandMemberSetupResource
    {
        abort_unless($setup->band_member_id === $member->id, 404);
        $this->authorizeForMember($member);

        return new BandMemberSetupResource($setup);
    }

    public function update(BandMemberSetupRequest $request, BandMember $member, BandMemberSetup $setup): BandMemberSetupResource
    {
        abort_unless($setup->band_member_id === $member->id, 404);
        $this->authorizeForMember($member);
        $data = $request->validated();
        if (!empty($data['is_default'])) {
            $member->setups()->where('id', '!=', $setup->id)->update(['is_default' => false]);
        }
        $setup->update($data);

        return new BandMemberSetupResource($setup->fresh());
    }

    public function destroy(BandMember $member, BandMemberSetup $setup): JsonResponse
    {
        abort_unless($setup->band_member_id === $member->id, 404);
        $this->authorizeForMember($member);
        $setup->delete();

        return response()->json(null, 204);
    }

    // ── Global: /band-profile/member-setups (all members, all setups) ─────────

    /**
     * Returns every setup for every band member in one call.
     * The rider editor uses it to resolve placements live while editing.
     */
    public function allSetups(): JsonResponse
    {
        $setups = BandMemberSetup::with('member:id,first_name,last_name,role')
            ->orderBy('band_member_id')
            ->orderBy('updated_at', 'desc')
            ->get();

        $grouped = $setups->groupBy('band_member_id')->map(function ($group) {
            $member = $group->first()->member;

            return [
                'member_id'    => $member->id,
                'member_name'  => $member->first_name . ' ' . $member->last_name,
                'member_role'  => $member->role,
                'setups'       => BandMemberSetupResource::collection($group)->resolve(),
            ];
        })->values();

        return response()->json(['data' => $grouped]);
    }
}
