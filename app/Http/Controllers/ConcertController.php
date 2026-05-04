<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConcertResource;
use App\Models\Concert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;

class ConcertController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $concerts = Concert::with(['venue', 'bands'])
            ->orderBy('date')
            ->orderBy('time')
            ->get();

        return ConcertResource::collection($concerts);
    }

    public function store(Request $request): ConcertResource
    {
        $data = $request->validate([
            'venue_id'    => 'required|exists:venues,id',
            'date'        => 'required|date_format:Y-m-d',
            'time'        => 'nullable|date_format:H:i',
            'description' => 'nullable|string|max:2000',
            'band_ids'    => 'nullable|array',
            'band_ids.*'  => 'integer|exists:bands,id',
        ]);

        $concert = Concert::create(Arr::except($data, ['band_ids']));

        if (array_key_exists('band_ids', $data)) {
            $concert->bands()->sync($data['band_ids'] ?? []);
        }

        return new ConcertResource($concert->load(['venue', 'bands']));
    }

    public function show(Concert $concert): ConcertResource
    {
        return new ConcertResource($concert->load(['venue', 'bands']));
    }

    public function update(Request $request, Concert $concert): ConcertResource
    {
        $data = $request->validate([
            'venue_id'    => 'sometimes|required|exists:venues,id',
            'date'        => 'sometimes|required|date_format:Y-m-d',
            'time'        => 'nullable|date_format:H:i',
            'description' => 'nullable|string|max:2000',
            'band_ids'    => 'nullable|array',
            'band_ids.*'  => 'integer|exists:bands,id',
        ]);

        $concert->update(Arr::except($data, ['band_ids']));

        if (array_key_exists('band_ids', $data)) {
            $concert->bands()->sync($data['band_ids'] ?? []);
        }

        return new ConcertResource($concert->load(['venue', 'bands']));
    }

    public function destroy(Concert $concert): JsonResponse
    {
        $concert->delete();

        return response()->json(null, 204);
    }
}
