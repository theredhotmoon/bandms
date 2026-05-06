<?php

namespace App\Http\Controllers;

use App\Http\Resources\TourResource;
use App\Http\Resources\TourSummaryResource;
use App\Models\Tour;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class TourController extends Controller
{
    public function index(): ResourceCollection
    {
        $tours = Tour::withCount('concerts')
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        return TourSummaryResource::collection($tours);
    }

    public function show(Tour $tour): TourResource
    {
        $tour->load(['images', 'links', 'concerts.venue']);

        return new TourResource($tour);
    }

    public function store(Request $request): TourResource
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'description'        => 'nullable|string',
            'start_date'         => 'nullable|date',
            'end_date'           => 'nullable|date|after_or_equal:start_date',
            'poster'             => 'nullable|url|max:500',
            'concert_ids'        => 'nullable|array',
            'concert_ids.*'      => 'integer|exists:concerts,id',
            'images'             => 'nullable|array',
            'images.*.url'       => 'required|url|max:500',
            'images.*.caption'   => 'nullable|string|max:255',
            'images.*.sort_order' => 'integer|min:0',
            'links'              => 'nullable|array',
            'links.*.label'      => 'required|string|max:255',
            'links.*.url'        => 'required|url|max:500',
        ]);

        $tour = Tour::create($validated);

        $tour->concerts()->sync($request->input('concert_ids', []));

        foreach ($request->input('images', []) as $img) {
            $tour->images()->create($img);
        }

        foreach ($request->input('links', []) as $link) {
            $tour->links()->create($link);
        }

        $tour->load(['images', 'links', 'concerts.venue']);

        return new TourResource($tour);
    }

    public function update(Request $request, Tour $tour): TourResource
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'description'        => 'nullable|string',
            'start_date'         => 'nullable|date',
            'end_date'           => 'nullable|date|after_or_equal:start_date',
            'poster'             => 'nullable|url|max:500',
            'concert_ids'        => 'nullable|array',
            'concert_ids.*'      => 'integer|exists:concerts,id',
            'images'             => 'nullable|array',
            'images.*.url'       => 'required|url|max:500',
            'images.*.caption'   => 'nullable|string|max:255',
            'images.*.sort_order' => 'integer|min:0',
            'links'              => 'nullable|array',
            'links.*.label'      => 'required|string|max:255',
            'links.*.url'        => 'required|url|max:500',
        ]);

        $tour->update($validated);

        $tour->concerts()->sync($request->input('concert_ids', []));

        $tour->images()->delete();
        foreach ($request->input('images', []) as $img) {
            $tour->images()->create($img);
        }

        $tour->links()->delete();
        foreach ($request->input('links', []) as $link) {
            $tour->links()->create($link);
        }

        $tour->load(['images', 'links', 'concerts.venue']);

        return new TourResource($tour);
    }

    public function destroy(Tour $tour): \Illuminate\Http\Response
    {
        $tour->delete();

        return response()->noContent();
    }
}
