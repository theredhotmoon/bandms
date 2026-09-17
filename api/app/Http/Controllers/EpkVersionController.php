<?php

namespace App\Http\Controllers;

use App\Models\EpkVersion;
use App\Services\EpkSnapshotBuilder;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EpkVersionController extends Controller
{
    public function index(): JsonResponse
    {
        $versions = EpkVersion::orderByDesc('version_number')
            ->get(['id', 'version_number', 'release_reason', 'status', 'published_at', 'created_at']);

        return response()->json(['data' => $versions]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'release_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if (EpkVersion::where('status', 'pending')->exists()) {
            return response()->json([
                'message' => 'A pending version already exists. Publish or discard it first.',
            ], 422);
        }

        $nextNumber = (EpkVersion::max('version_number') ?? 0) + 1;

        $version = EpkVersion::create([
            'version_number' => $nextNumber,
            'release_reason' => $data['release_reason'] ?? null,
            // The array cast encodes on write. Handing it a pre-encoded string
            // double-encodes silently and the public endpoint then serves a
            // JSON *string* under `data` — see the store() feature test.
            'snapshot'       => EpkSnapshotBuilder::build(),
            'status'         => 'pending',
        ]);

        return response()->json(['data' => $version], 201);
    }

    /**
     * Make this version the one `/epk` serves.
     *
     * Publishing a pending draft and restoring an archived version are the same
     * transition — the row becomes `published` and whatever was live is
     * archived — so one endpoint covers both. Unlike a tech rider, an archived
     * EPK version has no public link of its own, so restoring it is the only
     * way an old snapshot ever reaches a visitor again.
     */
    public function publish(EpkVersion $version): JsonResponse
    {
        if ($version->status === 'published') {
            return response()->json(['message' => 'This version is already live.'], 422);
        }

        // One transaction: the two writes must not leave the EPK with two live
        // versions or none, which is what the public endpoint keys on.
        DB::transaction(function () use ($version) {
            EpkVersion::where('status', 'published')->update(['status' => 'archived']);

            $version->update([
                'status'       => 'published',
                'published_at' => now(),
            ]);
        });

        SiteRebuild::markDirty('band-profile');

        return response()->json(['data' => $version]);
    }

    /**
     * Only the live version is protected. A pending draft was never served, and
     * an archived version serves nothing — it is history, not a permalink — so
     * both can go.
     */
    public function destroy(EpkVersion $version): JsonResponse
    {
        if ($version->status === 'published') {
            return response()->json([
                'message' => 'This version is what the public EPK currently serves. Make another version live first.',
            ], 422);
        }

        $version->delete();

        return response()->json(null, 204);
    }
}
