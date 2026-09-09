<?php

namespace App\Http\Controllers;

use App\Http\Resources\HeroImageResource;
use App\Models\HeroImage;
use App\Support\SiteRebuild;
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
     * Upload one or more new pictures into a scope, appended after whatever
     * is already there.
     */
    public function store(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'      => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            // Same bound as AlbumController::addPhotos — each file becomes its
            // own INSERT inside this request, so an unbounded array is an
            // unbounded write.
            'files'      => 'required|array|min:1|max:100',
            'files.*'    => 'required|image|max:20480',
            'captions'   => 'nullable|array',
            'captions.*' => 'nullable|string|max:255',
        ]);

        $maxPosition  = HeroImage::where('scope', $data['scope'])->max('position');
        $nextPosition = $maxPosition === null ? 0 : $maxPosition + 1;

        foreach (array_values($data['files']) as $index => $file) {
            $path = $file->store('hero-images', 'public');
            HeroImage::create([
                'scope'    => $data['scope'],
                'image'    => $path,
                'caption'  => $data['captions'][$index] ?? null,
                'position' => $nextPosition + $index,
            ]);
        }

        // The public site bakes these, so a save that does not rebuild leaves
        // the band looking at an unchanged page.
        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }

    /** Partial update of one row — caption and/or active. */
    public function patch(Request $request, HeroImage $heroImage): JsonResponse
    {
        $data = $request->validate([
            'caption' => 'sometimes|nullable|string|max:255',
            'active'  => 'sometimes|boolean',
        ]);

        $heroImage->update($data);

        SiteRebuild::requestIfAuto();

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
            // Bounded at 100, matching AlbumController's photo arrays. Each id
            // becomes its own INSERT inside the transaction below, so an
            // unbounded array is an unbounded write held open by one request.
            'photo_ids'   => ['present', 'array', 'max:100'],
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

        // The public site bakes these, so a save that does not rebuild leaves
        // the band looking at an unchanged page. The admin hides its manual
        // rebuild button when auto-rebuild is on, so without this there would be
        // no way at all to publish a hero change from that state.
        SiteRebuild::requestIfAuto();

        // Cast so an empty result encodes as {} rather than [] — the payload is
        // a map keyed by scope, and PHP's empty array would otherwise arrive as
        // a JSON array and contradict the client's Record<string, …> type.
        return response()->json(['data' => (object) $this->allScopes()]);
    }

    /**
     * All hero sets keyed by scope, each ordered by position.
     *
     * Includes inactive rows — the admin needs to see and re-enable them,
     * unlike the public site-config payload, which filters to active only.
     * A scope with zero rows is simply absent rather than present-and-empty.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function allScopes(): array
    {
        return HeroImage::orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => HeroImageResource::collection($rows)->resolve())
            ->all();
    }
}
