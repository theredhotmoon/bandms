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

        $relation = $clip->ownerRelation($type);
        $next = (int) DB::table('clippables')
            ->where('clippable_type', $type)->where('clippable_id', $id)->max('position') + 1;
        $relation->syncWithoutDetaching([$id => ['position' => $next]]);

        SiteRebuild::markDirty(ClipOwners::dirtyArea($type));
        SiteRebuild::markDirty('posts');

        return new ClipResource($clip->load(self::OWNER_RELATIONS));
    }

    public function detach(Request $request, Clip $clip): ClipResource
    {
        ['type' => $type, 'id' => $id] = $this->ownerInput($request);

        $clip->ownerRelation($type)->detach($id);

        SiteRebuild::markDirty(ClipOwners::dirtyArea($type));
        SiteRebuild::markDirty('posts');

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
        return array_intersect_key($data, array_flip(['provider', 'url', 'title', 'category', 'recorded_on', 'show_in_epk']));
    }

    /**
     * Replace the clip's owners with `attach`, positions from array index.
     * One sync() per owner type: an omitted type detaches everything of that
     * type, which is what "this is the full list" means.
     *
     * @param array<int, array{type: string, id: int}> $attach
     */
    private function syncOwners(Clip $clip, array $attach): void
    {
        $byType = array_fill_keys(ClipOwners::aliases(), []);
        foreach (array_values($attach) as $i => $row) {
            $byType[$row['type']][(int) $row['id']] = ['position' => $i];
        }
        foreach ($byType as $type => $rows) {
            $clip->ownerRelation($type)->sync($rows);
        }
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
}
