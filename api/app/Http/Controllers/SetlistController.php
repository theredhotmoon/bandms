<?php

namespace App\Http\Controllers;

use App\Http\Resources\SetlistResource;
use App\Http\Resources\SetlistSummaryResource;
use App\Http\Resources\SetlistItemResource;
use App\Models\Setlist;
use App\Models\SetlistItem;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SetlistController extends Controller
{
    // ── Setlists ──────────────────────────────────────────────────────────────

    public function index(): AnonymousResourceCollection
    {
        $setlists = Setlist::with(['items.song', 'concert.venue'])
            ->orderByDesc('updated_at')
            ->get();

        return SetlistSummaryResource::collection($setlists);
    }

    public function store(Request $request): SetlistResource
    {
        $data = $this->validatedSetlist($request);
        $setlist = Setlist::create($data);
        return new SetlistResource($setlist->load('concert.venue'));
    }

    public function show(Setlist $setlist): SetlistResource
    {
        return new SetlistResource($setlist->load('concert.venue'));
    }

    public function update(Request $request, Setlist $setlist): SetlistResource
    {
        $data = $this->validatedSetlist($request, partial: true);
        $setlist->update($data);
        return new SetlistResource($setlist->fresh()->load('concert.venue'));
    }

    public function destroy(Setlist $setlist): JsonResponse
    {
        $setlist->delete();
        return response()->json(null, 204);
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public function addItem(Request $request, Setlist $setlist): SetlistItemResource
    {
        $data = $request->validate([
            'song_id'               => ['required', 'integer', 'exists:songs,id'],
            'position'              => ['nullable', 'integer', 'min:1'],
            'is_encore'             => ['boolean'],
            'transition'            => ['nullable', 'in:pause,segue,talk,end'],
            'lighting_cue'          => ['nullable', 'string', 'max:255'],
            'sound_note'            => ['nullable', 'string', 'max:255'],
            'member_notes'          => ['nullable', 'array'],
            'override_duration_sec' => ['nullable', 'integer', 'min:1', 'max:7200'],
        ]);

        $data['setlist_id'] = $setlist->id;
        $data['position']   = $data['position'] ?? ($setlist->items()->max('position') + 1);
        $data['is_encore']  = $data['is_encore'] ?? false;

        $item = SetlistItem::create($data);
        $item->load('song');

        return new SetlistItemResource($item);
    }

    public function updateItem(Request $request, Setlist $setlist, SetlistItem $item): SetlistItemResource
    {
        abort_unless($item->setlist_id === $setlist->id, 404);

        $data = $request->validate([
            'is_encore'             => ['sometimes', 'boolean'],
            'transition'            => ['nullable', 'in:pause,segue,talk,end'],
            'lighting_cue'          => ['nullable', 'string', 'max:255'],
            'sound_note'            => ['nullable', 'string', 'max:255'],
            'member_notes'          => ['nullable', 'array'],
            'override_duration_sec' => ['nullable', 'integer', 'min:1', 'max:7200'],
        ]);

        $item->update($data);
        $item->load('song');

        return new SetlistItemResource($item->fresh());
    }

    public function removeItem(Setlist $setlist, SetlistItem $item): JsonResponse
    {
        abort_unless($item->setlist_id === $setlist->id, 404);
        $item->delete();
        $this->resequence($setlist);
        return response()->json(null, 204);
    }

    public function reorderItems(Request $request, Setlist $setlist): JsonResponse
    {
        $data = $request->validate([
            'order'   => ['required', 'array'],
            'order.*' => ['integer'],
        ]);

        foreach ($data['order'] as $position => $itemId) {
            SetlistItem::where('id', $itemId)
                ->where('setlist_id', $setlist->id)
                ->update(['position' => $position + 1]);
        }

        return response()->json(['ok' => true]);
    }

    // ── Import from setlist.fm ────────────────────────────────────────────────

    public function importFromSetlistFm(Request $request): SetlistResource
    {
        $data = $request->validate([
            'setlistfm_id'      => ['required', 'string'],
            'name'              => ['required', 'string', 'max:255'],
            'event_date'        => ['nullable', 'date'],
            'songs'             => ['required', 'array'],
            'songs.*.title'     => ['required', 'string', 'max:255'],
            'songs.*.is_encore' => ['boolean'],
        ]);

        $setlist = Setlist::create([
            'name'         => $data['name'],
            'event_date'   => $data['event_date'] ?? null,
            'setlistfm_id' => $data['setlistfm_id'],
        ]);

        foreach ($data['songs'] as $i => $songData) {
            $song = Song::firstOrCreate(
                ['title' => $songData['title']],
                ['title' => $songData['title']],
            );

            SetlistItem::create([
                'setlist_id' => $setlist->id,
                'song_id'    => $song->id,
                'position'   => $i + 1,
                'is_encore'  => $songData['is_encore'] ?? false,
            ]);
        }

        return new SetlistResource($setlist->fresh()->load('concert.venue'));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resequence(Setlist $setlist): void
    {
        $setlist->items()->orderBy('position')->get()
            ->each(fn ($item, $i) => $item->update(['position' => $i + 1]));
    }

    private function validatedSetlist(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'name'           => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'concert_id'     => ['nullable', 'integer', 'exists:concerts,id'],
            'setlistfm_id'   => ['nullable', 'string', 'max:255'],
            'foh_notes'      => ['nullable', 'string'],
            'lighting_notes' => ['nullable', 'string'],
        ]);
    }
}
