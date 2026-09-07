<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandResource;
use App\Models\Band;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BandController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return BandResource::collection(
            Band::with('authors')
                ->withCount('concerts')
                ->withMax('concerts', 'date')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request): BandResource
    {
        $data = $this->validatePayload($request);

        $band = DB::transaction(function () use ($data, $request) {
            $band = Band::create($data);
            $this->syncContacts($band, $request);

            return $band;
        });

        return new BandResource($band->load('authors'));
    }

    public function show(Band $band): BandResource
    {
        return new BandResource($band->load('authors'));
    }

    public function update(Request $request, Band $band): BandResource
    {
        $data = $this->validatePayload($request, $band);

        DB::transaction(function () use ($data, $request, $band) {
            $band->update($data);
            $this->syncContacts($band, $request);
        });

        return new BandResource($band->load('authors'));
    }

    public function destroy(Band $band): JsonResponse
    {
        $band->delete();

        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validatePayload(Request $request, ?Band $band = null): array
    {
        $name = $band
            ? ['sometimes', 'required', 'string', 'max:255', Rule::unique('bands')->ignore($band)]
            : ['required', 'string', 'max:255', Rule::unique('bands')];

        $validated = $request->validate([
            'name'         => $name,
            'website'      => ['nullable', 'url', 'max:500'],
            'author_ids'   => ['nullable', 'array'],
            'author_ids.*' => ['integer', 'exists:authors,id'],
        ]);

        // `author_ids` lives in a pivot, not on the model — passing it to
        // create()/update() would blow up on an unknown column.
        return array_diff_key($validated, ['author_ids' => null]);
    }

    /**
     * Absent `author_ids` leaves the existing contacts alone; an explicit empty
     * array clears them. A partial update must not silently drop the links.
     */
    private function syncContacts(Band $band, Request $request): void
    {
        if (! $request->has('author_ids')) {
            return;
        }

        $band->authors()->sync($request->input('author_ids', []));
    }
}
