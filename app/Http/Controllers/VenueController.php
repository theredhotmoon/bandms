<?php

namespace App\Http\Controllers;

use App\Http\Resources\VenueResource;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class VenueController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return VenueResource::collection(Venue::orderBy('name')->get());
    }

    public function store(Request $request): VenueResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('venues')],
            ...$this->locationRules(),
        ]);

        return new VenueResource(Venue::create($data));
    }

    public function show(Venue $venue): VenueResource
    {
        return new VenueResource($venue);
    }

    public function update(Request $request, Venue $venue): VenueResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('venues')->ignore($venue)],
            ...$this->locationRules(),
        ]);

        $venue->update($data);

        return new VenueResource($venue);
    }

    public function destroy(Venue $venue): JsonResponse
    {
        $venue->delete();

        return response()->json(null, 204);
    }

    private function locationRules(): array
    {
        return [
            'address'   => 'nullable|string|max:500',
            'latitude'  => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ];
    }
}
