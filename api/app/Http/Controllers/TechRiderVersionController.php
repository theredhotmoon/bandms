<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\TechRiderVersionResource;
use App\Models\TechRider;
use App\Models\TechRiderVersion;
use App\Services\TechRiderSnapshotBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Publishing a rider: taking an immutable copy of it and pointing the QR code
 * at that copy.
 *
 * Unlike EpkVersion there is no `pending` step. An EPK is drafted and then
 * released; a rider is *sent*, and the act of sending is what has to be
 * recorded. Splitting it in two would only create a state where a version
 * exists that nobody received.
 */
class TechRiderVersionController extends Controller
{
    public function index(TechRider $techRider): AnonymousResourceCollection
    {
        return TechRiderVersionResource::collection($techRider->versions);
    }

    /** Freeze the rider as it stands and make it the one the QR code serves. */
    public function store(Request $request, TechRider $techRider): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $snapshot = TechRiderSnapshotBuilder::build($techRider, $request);

        // The archive and the insert have to agree: a gap between them would
        // leave the rider with either two published versions or none, and the
        // public token resolves through exactly that column.
        $version = DB::transaction(function () use ($techRider, $data, $snapshot) {
            $techRider->versions()->where('status', 'published')->update(['status' => 'archived']);

            return $techRider->versions()->create([
                'version_number' => ((int) $techRider->versions()->max('version_number')) + 1,
                'notes'          => $data['notes'] ?? null,
                'snapshot'       => $snapshot,
                'status'         => 'published',
                'published_at'   => now(),
            ]);
        });

        return response()->json(['data' => new TechRiderVersionResource($version)], 201);
    }

    /**
     * One version, snapshot included.
     *
     * The list deliberately omits snapshots — they are large and nothing in a
     * list needs them. Comparing two versions does, so this serves them one at
     * a time, and the diffing happens client-side with the same resolver that
     * renders them. A server-side diff would need its own copy of the
     * derivation rules to have anything to compare.
     */
    public function show(TechRiderVersion $version): JsonResponse
    {
        return response()->json([
            'data' => array_merge($version->snapshot ?? [], [
                'version' => (new TechRiderVersionResource($version))->resolve(request()),
            ]),
        ]);
    }

    /**
     * Versions are a record of what a venue was sent, so the one currently
     * being served is not deletable — correcting it means publishing a newer
     * one, which is the honest version of the same action.
     */
    public function destroy(TechRiderVersion $version): JsonResponse
    {
        if ($version->status === 'published') {
            return response()->json([
                'message' => 'This version is the one the rider link currently serves. Publish a newer version instead.',
            ], 422);
        }

        $version->delete();

        return response()->json(null, 204);
    }
}
