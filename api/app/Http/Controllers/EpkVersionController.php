<?php

namespace App\Http\Controllers;

use App\Models\EpkVersion;
use App\Services\EpkSnapshotBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'snapshot'       => json_encode(EpkSnapshotBuilder::build()),
            'status'         => 'pending',
        ]);

        return response()->json(['data' => $version], 201);
    }

    public function publish(EpkVersion $version): JsonResponse
    {
        if ($version->status !== 'pending') {
            return response()->json(['message' => 'Only pending versions can be published.'], 422);
        }

        EpkVersion::where('status', 'published')->update(['status' => 'archived']);

        $version->update([
            'status'       => 'published',
            'published_at' => now(),
        ]);

        return response()->json(['data' => $version]);
    }

    public function destroy(EpkVersion $version): JsonResponse
    {
        if ($version->status !== 'pending') {
            return response()->json(['message' => 'Only pending versions can be discarded.'], 422);
        }

        $version->delete();

        return response()->json(null, 204);
    }
}
