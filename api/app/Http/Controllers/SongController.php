<?php

namespace App\Http\Controllers;

use App\Http\Resources\SongResource;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SongController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SongResource::collection(Song::orderBy('title')->get());
    }

    public function store(Request $request): SongResource
    {
        $data = $this->validated($request);
        return new SongResource(Song::create($data));
    }

    public function update(Request $request, Song $song): SongResource
    {
        $data = $this->validated($request, partial: true);
        $song->update($data);
        return new SongResource($song->fresh());
    }

    public function destroy(Song $song): JsonResponse
    {
        $song->delete();
        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'title'        => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'duration_sec' => ['nullable', 'integer', 'min:1', 'max:7200'],
            'bpm'          => ['nullable', 'integer', 'min:20', 'max:400'],
            'key'          => ['nullable', 'string', 'max:32'],
            'notes'        => ['nullable', 'string'],
        ]);
    }
}
