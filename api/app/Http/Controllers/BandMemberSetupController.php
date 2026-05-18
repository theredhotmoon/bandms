<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandMemberSetupResource;
use App\Http\Resources\BandMemberSetupSummaryResource;
use App\Models\BandMember;
use App\Models\BandMemberSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $setups = $member->setups()->orderBy('updated_at', 'desc')->get();

        return BandMemberSetupSummaryResource::collection($setups);
    }

    public function store(Request $request, BandMember $member): BandMemberSetupResource
    {
        $this->authorizeForMember($member);
        $data = $this->validated($request);
        $setup = $member->setups()->create($data);

        return new BandMemberSetupResource($setup);
    }

    public function show(BandMember $member, BandMemberSetup $setup): BandMemberSetupResource
    {
        abort_unless($setup->band_member_id === $member->id, 404);
        $this->authorizeForMember($member);

        return new BandMemberSetupResource($setup);
    }

    public function update(Request $request, BandMember $member, BandMemberSetup $setup): BandMemberSetupResource
    {
        abort_unless($setup->band_member_id === $member->id, 404);
        $this->authorizeForMember($member);
        $data = $this->validated($request, partial: true);
        $setup->update($data);

        return new BandMemberSetupResource($setup);
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
     * Used by the tech-rider import panel.
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

    // ── Validation ────────────────────────────────────────────────────────────

    private function validated(Request $request, bool $partial = false): array
    {
        $sometimes = $partial ? 'sometimes|' : '';

        return $request->validate([
            'name'                => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'instrument_id'       => ['nullable', 'integer', 'exists:instruments,id'],
            'signal_chain_type'   => [
                $partial ? 'sometimes' : 'required',
                'string',
                'in:modeler_mono,modeler_stereo,amp_mic,amp_mic_di,amp_di,'
                  . 'direct_mono,direct_stereo,drum_acoustic,drum_electronic,'
                  . 'drum_hybrid,vocal_mic,vocal_wireless,acoustic_di,'
                  . 'acoustic_mic,acoustic_mic_di,other',
            ],
            'inputs'              => ['nullable', 'array'],
            'monitor'             => ['nullable', 'array'],
            'backline'            => ['nullable', 'array'],
            'power'               => ['nullable', 'array'],
            'wireless'            => ['nullable', 'array'],
            'foh_notes'           => ['nullable', 'string'],
        ]);
    }
}
