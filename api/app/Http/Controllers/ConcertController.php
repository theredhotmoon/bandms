<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConcertResource;
use App\Models\Concert;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ConcertController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $concerts = Concert::with(['venue', 'bands', 'tags', 'links'])
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();

        return ConcertResource::collection($concerts);
    }

    public function store(Request $request): ConcertResource
    {
        $data = $request->validate($this->rules());

        if (empty($data['slug_en'] ?? null)) {
            $source = $data['name']['en'] ?? null;
            if (empty($source)) {
                $venueName = Venue::find($data['venue_id'])?->name ?? 'concert';
                $source = $venueName . ' ' . $data['date'];
            }
            $data['slug_en'] = Concert::generateSlug($source, null, 'slug_en');
        }

        $concert = Concert::create(Arr::except($data, ['bands', 'tag_ids', 'links']));

        $this->syncBands($concert, $data['bands'] ?? []);
        $this->syncTags($concert, $data['tag_ids'] ?? null);
        $this->syncLinks($concert, $data['links'] ?? []);

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
    }

    public function show(Concert $concert): ConcertResource
    {
        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
    }

    public function update(Request $request, Concert $concert): ConcertResource
    {
        $data = $request->validate($this->rules(update: true, concertId: $concert->id));

        $concert->update(Arr::except($data, ['bands', 'tag_ids', 'links']));

        $this->syncBands($concert, $data['bands'] ?? []);
        $this->syncTags($concert, $data['tag_ids'] ?? null);
        $this->syncLinks($concert, $data['links'] ?? []);

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
    }

    public function destroy(Concert $concert): JsonResponse
    {
        if ($concert->poster) {
            Storage::disk('public')->delete($concert->poster);
        }
        $concert->delete();

        return response()->json(null, 204);
    }

    public function uploadPoster(Request $request, Concert $concert): ConcertResource
    {
        $request->validate(['poster' => 'required|image|max:4096']);

        if ($concert->poster) {
            Storage::disk('public')->delete($concert->poster);
        }

        $path = $request->file('poster')->store('posters', 'public');
        $concert->update(['poster' => $path]);

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
    }

    public function destroyPoster(Concert $concert): ConcertResource
    {
        if ($concert->poster) {
            Storage::disk('public')->delete($concert->poster);
            $concert->update(['poster' => null]);
        }

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
    }

    private function rules(bool $update = false, ?int $concertId = null): array
    {
        $sometimes = $update ? 'sometimes|' : '';

        return [
            'name'        => 'nullable|array',
            'name.en'     => 'nullable|string|max:255',
            'name.pl'     => 'nullable|string|max:255',
            'venue_id'           => "{$sometimes}required|exists:venues,id",
            'date'               => "{$sometimes}required|date_format:Y-m-d",
            'slug_en'            => ['nullable', 'string', 'max:255', Rule::unique('concerts', 'slug_en')->ignore($concertId)],
            'slug_pl'            => ['nullable', 'string', 'max:255', Rule::unique('concerts', 'slug_pl')->ignore($concertId)],
            'doors_open'         => 'nullable|date_format:H:i',
            'sound_check_time'   => 'nullable|date_format:H:i',
            'start_time'         => 'nullable|date_format:H:i',
            'own_sort_order'     => 'nullable|integer|min:1',
            'description'        => 'nullable|array',
            'description.en'     => 'nullable|string|max:2000',
            'description.pl'     => 'nullable|string|max:2000',
            'bands'              => 'nullable|array',
            'bands.*.id'         => 'required|integer|exists:bands,id',
            'bands.*.sort_order' => 'required|integer|min:1',
            'bands.*.play_time'  => 'nullable|date_format:H:i',
            'tag_ids'            => 'nullable|array',
            'tag_ids.*'          => 'integer|exists:tags,id',
            'links'              => 'nullable|array',
            'links.*.label'      => 'required|string|max:255',
            'links.*.url'        => 'required|url|max:500',
        ];
    }

    private function syncBands(Concert $concert, array $bands): void
    {
        $sync = collect($bands)->mapWithKeys(fn ($b) => [
            $b['id'] => [
                'sort_order' => $b['sort_order'],
                'play_time'  => $b['play_time'] ?? null,
            ],
        ])->toArray();

        $concert->bands()->sync($sync);
    }

    private function syncTags(Concert $concert, ?array $tagIds): void
    {
        if ($tagIds !== null) {
            $concert->tags()->sync($tagIds);
        }
    }

    private function syncLinks(Concert $concert, array $links): void
    {
        $concert->links()->delete();
        foreach ($links as $link) {
            $concert->links()->create($link);
        }
    }
}
