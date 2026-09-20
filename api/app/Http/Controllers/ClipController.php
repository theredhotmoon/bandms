<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClipRequest;
use App\Http\Resources\ClipResource;
use App\Models\Clip;
use App\Support\ClipOwners;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClipController extends Controller
{
    private const OWNER_RELATIONS = ['concerts.venue', 'releases', 'shopItems', 'albums'];

    public function index(): AnonymousResourceCollection
    {
        $clips = Clip::with(self::OWNER_RELATIONS)
            ->orderByDesc('recorded_on')
            ->orderByDesc('id')
            ->get();

        return ClipResource::collection($clips);
    }

    public function store(ClipRequest $request): JsonResponse
    {
        $data = $request->validated();

        $clip = DB::transaction(function () use ($data) {
            $clip = Clip::create($this->attributes($data) + ['category' => $data['category'] ?? 'live']);
            if (array_key_exists('attach', $data)) {
                $this->syncOwners($clip, $data['attach']);
            }

            return $clip;
        });

        $this->markDirty($clip);

        return (new ClipResource($clip->load(self::OWNER_RELATIONS)))->response()->setStatusCode(201);
    }

    public function update(ClipRequest $request, Clip $clip): ClipResource
    {
        $data = $request->validated();

        // Areas of owners being *removed* must rebuild too.
        $this->markDirty($clip->load(self::OWNER_RELATIONS));

        DB::transaction(function () use ($clip, $data) {
            $clip->update($this->attributes($data));
            if (array_key_exists('attach', $data)) {
                $this->syncOwners($clip, $data['attach']);
            }
        });

        $clip->unsetRelations();
        $this->markDirty($clip->load(self::OWNER_RELATIONS));

        return new ClipResource($clip);
    }

    public function destroy(Clip $clip): JsonResponse
    {
        $this->markDirty($clip->load(self::OWNER_RELATIONS));
        $clip->delete();

        return response()->json(null, 204);
    }

    public function attach(Request $request, Clip $clip): ClipResource
    {
        ['type' => $type, 'id' => $id] = $this->ownerInput($request);

        $clip->ownerRelation($type)->syncWithoutDetaching([$id => ['position' => $this->nextPosition($type, $id)]]);

        $this->markOwnerDirty($clip, $type);

        return new ClipResource($clip->load(self::OWNER_RELATIONS));
    }

    public function detach(Request $request, Clip $clip): ClipResource
    {
        ['type' => $type, 'id' => $id] = $this->ownerInput($request);

        $clip->ownerRelation($type)->detach($id);

        $this->markOwnerDirty($clip, $type);

        return new ClipResource($clip->load(self::OWNER_RELATIONS));
    }

    /** @return array{type: string, id: int} */
    private function ownerInput(Request $request): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(ClipOwners::aliases())],
            'id'   => ['required', 'integer'],
        ]);

        if (! ClipOwners::MAP[$data['type']]::whereKey($data['id'])->exists()) {
            abort(422, "The selected {$data['type']} does not exist.");
        }

        return ['type' => $data['type'], 'id' => (int) $data['id']];
    }

    /** Column attributes from a validated payload — never `attach`. */
    private function attributes(array $data): array
    {
        $attrs = array_intersect_key($data, array_flip(['url', 'title', 'category', 'recorded_on', 'show_in_epk']));

        // `provider` is stamped from `url` by ClipRequest, never taken from the
        // client: a PUT without a url must leave it alone, and the column is
        // NOT NULL. Same for `category` — the rule is nullable, the column is
        // not, and array union would keep a present-but-null key.
        if (isset($data['url'])) {
            $attrs['provider'] = $data['provider'];
        }
        if (array_key_exists('category', $attrs) && $attrs['category'] === null) {
            $attrs['category'] = 'live';
        }

        return $attrs;
    }

    /**
     * Replace the clip's owners with `attach`. One sync() per owner type: an
     * omitted type detaches everything of that type, which is what "this is
     * the full list" means.
     *
     * `position` is the clip's slot within the *owner's* list — what
     * HasClips::clips() orders by and the public page renders. An owner the
     * clip already has keeps its slot; a new one goes to the end of that
     * owner's list, exactly as attach() does. The order of `attach` itself
     * carries no meaning, so an unrelated edit from the admin form (which
     * always resends the full list) cannot reorder a show's clips.
     *
     * @param array<int, array{type: string, id: int}> $attach
     */
    private function syncOwners(Clip $clip, array $attach): void
    {
        $byType = array_fill_keys(ClipOwners::aliases(), []);
        foreach ($attach as $row) {
            $byType[$row['type']][] = (int) $row['id'];
        }

        foreach ($byType as $type => $ids) {
            $current = DB::table('clippables')
                ->where('clip_id', $clip->id)->where('clippable_type', $type)
                ->pluck('position', 'clippable_id');

            $rows = [];
            foreach (array_unique($ids) as $id) {
                $rows[$id] = ['position' => $current->has($id) ? (int) $current[$id] : $this->nextPosition($type, $id)];
            }
            $clip->ownerRelation($type)->sync($rows);
        }
    }

    /** The next free slot in one owner's clip list; 0 for an owner with none. */
    private function nextPosition(string $type, int $id): int
    {
        $max = DB::table('clippables')
            ->where('clippable_type', $type)->where('clippable_id', $id)->max('position');

        return $max === null ? 0 : (int) $max + 1;
    }

    /** Every area a clip can appear in: each owner's page, plus posts (ref blocks) and the EPK. */
    private function markDirty(Clip $clip): void
    {
        foreach ($clip->ownersList() as $owner) {
            if ($area = ClipOwners::dirtyArea($owner['type'])) {
                SiteRebuild::markDirty($area);
            }
        }
        SiteRebuild::markDirty('posts');
        if ($clip->show_in_epk || $clip->wasChanged('show_in_epk')) {
            SiteRebuild::markDirty('band-profile');
        }
    }

    /**
     * Dirty areas for a single attach/detach: the one owner's area, posts
     * (ref blocks), and the EPK when this clip is flagged for it — the same
     * three areas markDirty() covers for store/update/destroy, kept in sync
     * so attach/detach cannot silently skip the EPK rebuild.
     */
    private function markOwnerDirty(Clip $clip, string $type): void
    {
        if ($area = ClipOwners::dirtyArea($type)) {
            SiteRebuild::markDirty($area);
        }
        SiteRebuild::markDirty('posts');
        if ($clip->show_in_epk) {
            SiteRebuild::markDirty('band-profile');
        }
    }
}
