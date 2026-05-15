<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuthorResource;
use App\Http\Resources\AuthorSummaryResource;
use App\Models\Author;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;

class AuthorController extends Controller
{
    public function index(): ResourceCollection
    {
        $authors = Author::orderBy('name')->get();

        return AuthorSummaryResource::collection($authors);
    }

    public function show(Author $author): AuthorResource
    {
        $author->load('pressReleases', 'concerts', 'tours', 'photos');

        return new AuthorResource($author);
    }

    public function store(Request $request): AuthorResource
    {
        $validated = $this->validatePayload($request);
        $author = Author::create($validated);
        $this->syncRelations($author, $request);

        $author->load('pressReleases', 'concerts', 'tours', 'photos');

        return new AuthorResource($author);
    }

    public function update(Request $request, Author $author): AuthorResource
    {
        $validated = $this->validatePayload($request);
        $author->update($validated);
        $this->syncRelations($author, $request);

        $author->load('pressReleases', 'concerts', 'tours', 'photos');

        return new AuthorResource($author);
    }

    public function destroy(Author $author): Response
    {
        $author->delete();

        return response()->noContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name'               => 'required|string|max:255',
            'email'              => 'nullable|email|max:255',
            'facebook'           => 'nullable|string|max:255',
            'instagram'          => 'nullable|string|max:255',
            'whatsapp'           => 'nullable|string|max:50',
            'phone'              => 'nullable|string|max:50',
            'notes'              => 'nullable|string',
            'press_release_ids'  => 'nullable|array',
            'press_release_ids.*'=> 'integer|exists:press_releases,id',
            'concert_ids'        => 'nullable|array',
            'concert_ids.*'      => 'integer|exists:concerts,id',
            'tour_ids'           => 'nullable|array',
            'tour_ids.*'         => 'integer|exists:tours,id',
            'photo_ids'          => 'nullable|array',
            'photo_ids.*'        => 'integer|exists:photos,id',
        ]);
    }

    private function syncRelations(Author $author, Request $request): void
    {
        $author->pressReleases()->sync($request->input('press_release_ids', []));
        $author->concerts()->sync($request->input('concert_ids', []));
        $author->tours()->sync($request->input('tour_ids', []));
        $author->photos()->sync($request->input('photo_ids', []));
    }
}
