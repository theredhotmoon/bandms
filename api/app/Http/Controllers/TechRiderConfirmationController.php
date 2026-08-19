<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\TechRiderConfirmationResource;
use App\Mail\RigConfirmationRequest;
use App\Models\BandMember;
use App\Models\TechRider;
use App\Models\TechRiderConfirmation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Asking the band to confirm their rigs, and recording who has.
 *
 * The completeness bar says whether a musician's rig looks filled in. It cannot
 * say whether the musician has *looked* at it — a rig saved in March is
 * complete and may still be wrong for tonight. This is the missing half.
 */
class TechRiderConfirmationController extends Controller
{
    public function index(TechRider $techRider): AnonymousResourceCollection
    {
        return TechRiderConfirmationResource::collection(
            $techRider->confirmations()->with('bandMember')->get(),
        );
    }

    /**
     * Ask everyone playing tonight to confirm their rig.
     *
     * Only members who can sign in and have an address to write to: the mail
     * points at My Setups, which is behind their login. Anyone else has to be
     * asked the way they were being asked before this existed.
     */
    public function store(TechRider $techRider): JsonResponse
    {
        $members = $this->askableMembers($techRider);

        if ($members->isEmpty()) {
            return response()->json([
                'message' => 'Nobody in tonight\'s lineup has a login and an email address to write to.',
            ], 422);
        }

        $failed = [];

        foreach ($members as $member) {
            $techRider->confirmations()->updateOrCreate(
                ['band_member_id' => $member->id],
                // Re-asking clears the previous answer on purpose: confirming
                // the rider as it stood two weeks ago is not confirming it now.
                ['requested_at' => now(), 'confirmed_at' => null],
            );

            try {
                Mail::to($member->login_email)->send(new RigConfirmationRequest($member, $techRider));
            } catch (\Throwable $e) {
                // The request is recorded either way — the band can still chase
                // it in person, and losing the whole batch because one address
                // bounces would be worse than reporting the one that failed.
                Log::warning('Rig confirmation mail failed', [
                    'rider'  => $techRider->id,
                    'member' => $member->id,
                    'error'  => $e->getMessage(),
                ]);
                $failed[] = $member->id;
            }
        }

        return response()->json([
            'data'      => TechRiderConfirmationResource::collection(
                $techRider->confirmations()->with('bandMember')->get(),
            )->resolve(request()),
            'requested' => $members->count(),
            'failed'    => $failed,
        ]);
    }

    /**
     * The signed-in musician confirms their own rig.
     *
     * Scoped to the caller rather than taking a member id: confirming on
     * somebody else's behalf is exactly the thing this feature exists to stop.
     */
    public function confirm(TechRider $techRider): JsonResponse
    {
        /** @var User $user */
        $user = auth()->user();

        if (! $user->band_member_id) {
            return response()->json([
                'message' => 'Your account is not linked to a band member profile.',
            ], 422);
        }

        $confirmation = $techRider->confirmations()->updateOrCreate(
            ['band_member_id' => $user->band_member_id],
            ['confirmed_at' => now()],
        );

        return response()->json([
            'data' => (new TechRiderConfirmationResource($confirmation->load('bandMember')))->resolve(request()),
        ]);
    }

    /** Riders currently waiting on the signed-in musician. */
    public function mine(): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = auth()->user();

        // An admin without a linked band member has nothing waiting on them.
        // Said explicitly: `where('band_member_id', null)` becomes `IS NULL` in
        // the query builder, which would return the right answer for the wrong
        // reason and quietly stop doing so if the column ever went nullable.
        if (! $user->band_member_id) {
            return TechRiderConfirmationResource::collection(collect());
        }

        $pending = TechRiderConfirmation::with(['bandMember', 'techRider.concert.venue'])
            ->where('band_member_id', $user->band_member_id)
            ->whereNotNull('requested_at')
            ->whereNull('confirmed_at')
            ->latest('requested_at')
            ->get();

        return TechRiderConfirmationResource::collection($pending);
    }

    /**
     * Members in tonight's lineup who can actually be written to.
     *
     * @return \Illuminate\Support\Collection<int, BandMember>
     */
    private function askableMembers(TechRider $techRider): \Illuminate\Support\Collection
    {
        $ids = collect($techRider->gig_lineup['regular_members'] ?? [])
            ->filter(fn ($entry) => ! empty($entry['is_available']))
            ->pluck('band_member_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique();

        if ($ids->isEmpty()) {
            return collect();
        }

        return BandMember::whereIn('id', $ids)
            ->where('can_login', true)
            ->whereNotNull('login_email')
            ->get();
    }
}
