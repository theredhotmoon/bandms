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
        return VenueResource::collection(Venue::with('tags', 'socialLinks')->orderBy('name')->get());
    }

    public function store(Request $request): VenueResource
    {
        $data = $request->validate([
            'name'                    => ['required', 'string', 'max:255', Rule::unique('venues')],
            'tag_ids'                 => ['nullable', 'array'],
            'tag_ids.*'               => ['integer', 'exists:tags,id'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
            ...$this->locationRules(),
        ]);

        $venue = Venue::create(\Illuminate\Support\Arr::except($data, ['tag_ids', 'social_links']));

        if (array_key_exists('tag_ids', $data)) {
            $venue->tags()->sync($data['tag_ids'] ?? []);
        }

        foreach ($data['social_links'] ?? [] as $link) {
            $venue->socialLinks()->create($link);
        }

        return new VenueResource($venue->load('tags', 'socialLinks'));
    }

    public function show(Venue $venue): VenueResource
    {
        return new VenueResource($venue->load('tags', 'socialLinks'));
    }

    public function update(Request $request, Venue $venue): VenueResource
    {
        $data = $request->validate([
            'name'                    => ['sometimes', 'required', 'string', 'max:255', Rule::unique('venues')->ignore($venue)],
            'tag_ids'                 => ['nullable', 'array'],
            'tag_ids.*'               => ['integer', 'exists:tags,id'],
            'social_links'            => ['nullable', 'array'],
            'social_links.*.platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'social_links.*.url'      => ['required', 'url', 'max:500'],
            ...$this->locationRules(),
        ]);

        $venue->update(\Illuminate\Support\Arr::except($data, ['tag_ids', 'social_links']));

        if (array_key_exists('tag_ids', $data)) {
            $venue->tags()->sync($data['tag_ids'] ?? []);
        }

        if (array_key_exists('social_links', $data)) {
            $venue->socialLinks()->delete();
            foreach ($data['social_links'] as $link) {
                $venue->socialLinks()->create($link);
            }
        }

        return new VenueResource($venue->load('tags', 'socialLinks'));
    }

    public function destroy(Venue $venue): JsonResponse
    {
        $venue->delete();

        return response()->json(null, 204);
    }

    private function locationRules(): array
    {
        return [
            'street'          => 'nullable|string|max:255',
            'street_number'   => 'nullable|string|max:20',
            'city'            => 'nullable|string|max:100',
            'postcode'        => 'nullable|string|max:20',
            'additional_info' => 'nullable|string|max:500',
            'capacity'        => 'nullable|integer|min:1|max:1000000',
            'latitude'        => 'nullable|numeric|between:-90,90',
            'longitude'       => 'nullable|numeric|between:-180,180',
        ];
    }
}
