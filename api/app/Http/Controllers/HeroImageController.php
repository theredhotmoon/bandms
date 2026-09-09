<?php

namespace App\Http\Controllers;

use App\Http\Resources\HeroImageResource;
use App\Models\HeroImage;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
     * Reorder every row already in one scope. Every id in `order` must
     * already belong to that scope — Rule::exists's `where` clause rejects
     * anything else with a 422 rather than silently ignoring it, so a
     * mis-scoped id cannot leave the set half-reordered.
     */
    public function reorder(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'   => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            'order'   => 'required|array',
            'order.*' => ['integer', Rule::exists('hero_images', 'id')->where('scope', $scope)],
        ]);

        foreach ($data['order'] as $position => $id) {
            HeroImage::where('id', $id)->where('scope', $data['scope'])->update(['position' => $position]);
        }

        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }

    /** Delete one picture and its file. */
    public function destroy(HeroImage $heroImage): JsonResponse
    {
        if ($heroImage->image) {
            Storage::disk('public')->delete($heroImage->image);
        }

        $heroImage->delete();

        SiteRebuild::requestIfAuto();

        return response()->json(null, 204);
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
