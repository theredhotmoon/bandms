<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConcertResource;
use App\Models\Concert;
use App\Models\Venue;
use App\Support\ContentLocales;
use App\Support\Locales;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ConcertController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $concerts = Concert::with(['venue', 'bands', 'tags', 'links', 'members'])
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();

        return ConcertResource::collection($concerts);
    }

    public function store(Request $request): ConcertResource
    {
        // A concert cannot exist without a venue, so an empty venues table is a
        // dead end rather than a bad field. Say so plainly — `exists:venues,id`
        // cannot tell "you picked a missing venue" from "there are none yet".
        if (Venue::count() === 0) {
            throw ValidationException::withMessages([
                'venue_id' => 'Add at least one venue before creating a concert.',
            ]);
        }

        $data = $request->validate($this->rules(), $this->messages());

        $concert = new Concert(Arr::except($data, ['bands', 'tag_ids', 'member_ids', 'links', 'slug']));
        // On create every locale gets a slug, from its own name or venue + date —
        // what the admin form always generated client-side for Polish.
        $venueDate = trim((Venue::find($data['venue_id'])?->name ?? 'concert') . ' ' . $data['date']);
        $concert->applySlugBag(
            $data['slug'] ?? null,
            $this->slugSource($data['name'] ?? [], $data['venue_id'], $data['date']),
            collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => ($data['name'][$c] ?? null) ?: $venueDate])->all(),
        );
        $concert->save();

        $this->syncBands($concert, $data['bands'] ?? []);
        $this->syncTags($concert, $data['tag_ids'] ?? null);
        $this->syncMembers($concert, $data);
        $this->syncLinks($concert, $data['links'] ?? []);

        SiteRebuild::markDirty('concerts');

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links', 'clips', 'members']));
    }

    public function show(Concert $concert): ConcertResource
    {
        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links', 'clips', 'members']));
    }

    public function update(Request $request, Concert $concert): ConcertResource
    {
        $data = $request->validate($this->rules(update: true, concertId: $concert->id), $this->messages());

        // Slugs through applySlugBag(): update() used to write the raw columns,
        // so clearing a concert's slug in the admin quietly moved its public
        // page to /concert-{id}. The default slug is never blanked now.
        $concert->fill(Arr::except($data, ['bands', 'tag_ids', 'member_ids', 'links', 'slug']));
        if (array_key_exists('slug', $data)) {
            $concert->applySlugBag($data['slug'], $this->slugSource(
                $concert->getTranslations('name'), $concert->venue_id, $concert->date?->format('Y-m-d') ?? '',
            ));
        }
        $concert->save();

        $this->syncBands($concert, $data['bands'] ?? []);
        $this->syncTags($concert, $data['tag_ids'] ?? null);
        $this->syncMembers($concert, $data);
        $this->syncLinks($concert, $data['links'] ?? []);

        SiteRebuild::markDirty('concerts');

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links', 'clips', 'members']));
    }

    public function destroy(Concert $concert): JsonResponse
    {
        if ($concert->poster) {
            Storage::disk('public')->delete($concert->poster);
        }
        $concert->delete();

        SiteRebuild::markDirty('concerts');

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

        SiteRebuild::markDirty('concerts');

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links', 'clips', 'members']));
    }

    public function destroyPoster(Concert $concert): ConcertResource
    {
        if ($concert->poster) {
            Storage::disk('public')->delete($concert->poster);
            $concert->update(['poster' => null]);
        }

        SiteRebuild::markDirty('concerts');

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links', 'clips', 'members']));
    }

    private function messages(): array
    {
        return [
            'venue_id.required' => 'Please select a venue.',
            'venue_id.exists'   => 'Please select a venue.',
        ];
    }

    /**
     * What a generated concert slug is made from: the name, else venue + date —
     * the rule this controller has always used.
     */
    private function slugSource(array $names, ?int $venueId, string $date): string
    {
        return ContentLocales::firstFilled($names, Locales::default())
            ?? trim((Venue::find($venueId)?->name ?? 'concert') . ' ' . $date);
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
            // Who played. Absent leaves the links alone; [] clears them.
            'member_ids'         => 'nullable|array',
            'member_ids.*'       => 'integer|distinct|exists:band_members,id',
            'links'              => 'nullable|array',
            'links.*.label'      => 'required|string|max:255',
            'links.*.url'        => 'required|url|max:500',
        ] + Concert::translatedSlugRules($concertId);
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

    /**
     * Who played. Keyed on presence, not null-ness: an explicit [] clears the
     * line-up, while a save that never mentions it leaves it alone.
     */
    private function syncMembers(Concert $concert, array $data): void
    {
        if (array_key_exists('member_ids', $data)) {
            $changes = $concert->members()->sync($data['member_ids'] ?? []);
            // Member pages list each member's gigs — but only a changed line-up
            // touches them. The form always sends member_ids, so marking on
            // every save would queue a rebuild for an unrelated edit.
            if (array_filter($changes)) {
                SiteRebuild::markDirty('band-members');
            }
        }
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
