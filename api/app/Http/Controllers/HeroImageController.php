<?php

namespace App\Http\Controllers;

use App\Http\Resources\HeroImageResource;
use App\Models\HeroImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class HeroImageController extends Controller
{
    /** Every populated scope in one response — the editor shows them all at once. */
    public function index(): JsonResponse
    {
        // Cast so an empty result encodes as {} rather than [] — the payload is
        // a map keyed by scope, and PHP's empty array would otherwise arrive as
        // a JSON array and contradict the client's Record<string, …> type.
        return response()->json(['data' => (object) $this->allScopes()]);
    }

    /**
     * Replace one scope's set, in payload order.
     *
     * Delete-and-recreate rather than a diff: it is the shape social links
     * already use, and it makes "the payload is the truth" literally so. The
     * transaction is what stops a failure part-way leaving a half-saved set.
     */
    public function update(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'       => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            'photo_ids'   => ['present', 'array'],
            'photo_ids.*' => ['integer', 'exists:photos,id'],
        ]);

        DB::transaction(function () use ($data) {
            HeroImage::where('scope', $data['scope'])->delete();

            foreach ($data['photo_ids'] as $position => $photoId) {
                HeroImage::create([
                    'photo_id' => $photoId,
                    'scope'    => $data['scope'],
                    'position' => $position,
                ]);
            }
        });

        // Cast so an empty result encodes as {} rather than [] — the payload is
        // a map keyed by scope, and PHP's empty array would otherwise arrive as
        // a JSON array and contradict the client's Record<string, …> type.
        return response()->json(['data' => (object) $this->allScopes()]);
    }

    /**
     * All hero sets keyed by scope, each ordered by position.
     *
     * Empty scopes are simply absent rather than present-and-empty: the public
     * resolver treats "no override" and "an empty override" identically, so
     * emitting both shapes would be two ways of saying one thing.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function allScopes(): array
    {
        return HeroImage::with('photo')
            ->orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => HeroImageResource::collection($rows)->resolve())
            ->all();
    }
}
