<?php

namespace App\Http\Controllers;

use App\Http\Resources\PressReleaseResource;
use App\Http\Resources\PressReleaseSummaryResource;
use App\Models\BandProfile;
use App\Models\PressRelease;
use DOMDocument;
use DOMXPath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

class PressReleaseController extends Controller
{
    public function index(): ResourceCollection
    {
        $items = PressRelease::with('tags')
            ->withCount(['concerts', 'posts', 'albums', 'releases', 'tours', 'authors'])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        return PressReleaseSummaryResource::collection($items);
    }

    public function show(PressRelease $pressRelease): PressReleaseResource
    {
        $pressRelease->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags');

        return new PressReleaseResource($pressRelease);
    }

    public function fetchMeta(Request $request): JsonResponse
    {
        $data = $request->validate(['url' => 'required|url|max:1000']);

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (compatible; BandMS-Bot/1.0; +http://localhost)',
                'Accept'     => 'text/html,application/xhtml+xml',
            ])->timeout(10)->get($data['url']);

            if (! $response->successful()) {
                return response()->json(['error' => 'Could not fetch the URL (HTTP ' . $response->status() . ')'], 422);
            }

            return response()->json(['data' => $this->parseOgMeta($response->body())]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch URL: ' . $e->getMessage()], 422);
        }
    }

    public function store(Request $request): PressReleaseResource
    {
        $validated = $this->validatePayload($request);
        $validated['profile_id'] = BandProfile::value('id') ?? 1;

        $pr = PressRelease::create($validated);
        $this->syncRelations($pr, $request);

        $pr->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags');

        return new PressReleaseResource($pr);
    }

    public function update(Request $request, PressRelease $pressRelease): PressReleaseResource
    {
        $validated = $this->validatePayload($request);
        $pressRelease->update($validated);
        $this->syncRelations($pressRelease, $request);

        $pressRelease->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags');

        return new PressReleaseResource($pressRelease);
    }

    public function destroy(PressRelease $pressRelease): Response
    {
        $pressRelease->delete();

        return response()->noContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'url'            => 'required|url|max:1000',
            'og_title'       => 'nullable|string|max:500',
            'og_description' => 'nullable|string',
            'og_image'       => 'nullable|url|max:1000',
            'og_site_name'   => 'nullable|string|max:255',
            'published_at'   => 'nullable|date',
            'featured'       => 'boolean',
            'concert_ids'    => 'nullable|array',
            'concert_ids.*'  => 'integer|exists:concerts,id',
            'post_ids'       => 'nullable|array',
            'post_ids.*'     => 'integer|exists:posts,id',
            'album_ids'      => 'nullable|array',
            'album_ids.*'    => 'integer|exists:albums,id',
            'release_ids'    => 'nullable|array',
            'release_ids.*'  => 'integer|exists:releases,id',
            'tour_ids'       => 'nullable|array',
            'tour_ids.*'     => 'integer|exists:tours,id',
            'tag_ids'        => 'nullable|array',
            'tag_ids.*'      => 'integer|exists:tags,id',
        ]);
    }

    private function syncRelations(PressRelease $pr, Request $request): void
    {
        $pr->concerts()->sync($request->input('concert_ids', []));
        $pr->posts()->sync($request->input('post_ids', []));
        $pr->albums()->sync($request->input('album_ids', []));
        $pr->releases()->sync($request->input('release_ids', []));
        $pr->tours()->sync($request->input('tour_ids', []));
        $pr->tags()->sync($request->input('tag_ids', []));
    }

    private function parseOgMeta(string $html): array
    {
        $meta = [
            'og_title'       => null,
            'og_description' => null,
            'og_image'       => null,
            'og_site_name'   => null,
        ];

        $prev = libxml_use_internal_errors(true);
        $dom  = new DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . $html);
        libxml_use_internal_errors($prev);

        $xpath = new DOMXPath($dom);

        foreach ($xpath->query('//meta') as $node) {
            $property = $node->getAttribute('property') ?: $node->getAttribute('name');
            $content  = $node->getAttribute('content');
            match ($property) {
                'og:title'       => $meta['og_title']       = $content,
                'og:description' => $meta['og_description'] = $content,
                'og:image'       => $meta['og_image']       = $content,
                'og:site_name'   => $meta['og_site_name']   = $content,
                default          => null,
            };
        }

        if (! $meta['og_title']) {
            $titles = $xpath->query('//title');
            if ($titles->length > 0) {
                $meta['og_title'] = trim($titles->item(0)->textContent);
            }
        }
        if (! $meta['og_description']) {
            foreach ($xpath->query('//meta[@name="description"]') as $node) {
                $meta['og_description'] = $node->getAttribute('content');
                break;
            }
        }

        return $meta;
    }
}
