<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandResource;
use App\Models\Band;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class BandController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return BandResource::collection(
            Band::withCount('concerts')
                ->withMax('concerts', 'date')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request): BandResource
    {
        $data = $request->validate([
            'name'    => ['required', 'string', 'max:255', Rule::unique('bands')],
            'website' => ['nullable', 'url', 'max:500'],
        ]);

        return new BandResource(Band::create($data));
    }

    public function show(Band $band): BandResource
    {
        return new BandResource($band);
    }

    public function update(Request $request, Band $band): BandResource
    {
        $data = $request->validate([
            'name'    => ['sometimes', 'required', 'string', 'max:255', Rule::unique('bands')->ignore($band)],
            'website' => ['nullable', 'url', 'max:500'],
        ]);

        $band->update($data);

        return new BandResource($band);
    }

    public function destroy(Band $band): JsonResponse
    {
        $band->delete();

        return response()->json(null, 204);
    }
}
