<?php

namespace App\Http\Controllers;

use App\Http\Resources\PressReleaseResource;
use App\Http\Resources\PressReleaseSummaryResource;
use App\Models\BandProfile;
use App\Models\PressRelease;
use App\Support\SiteRebuild;
use DOMDocument;
use DOMXPath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
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
        // Public route: a linked draft post must not surface here either — the
        // resource emits each post's title and slug. Safe to scope, because the
        // admin's press-release form has no linked-posts picker to prefill.
        // `members` rides along: the admin form is seeded from this endpoint,
        // and without member_ids a save would clear the article's members.
        $pressRelease->load(['concerts', 'posts' => fn ($q) => $q->published(), 'albums', 'releases', 'tours', 'tags', 'members']);

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

        $pr = PressRelease::create(Arr::except($validated, ['member_ids']));
        $this->syncRelations($pr, $request);
        $this->syncMembers($pr, $validated);

        $pr->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags', 'members');

        SiteRebuild::markDirty('press-releases');

        return new PressReleaseResource($pr);
    }

    public function update(Request $request, PressRelease $pressRelease): PressReleaseResource
    {
        $validated = $this->validatePayload($request);
        $pressRelease->update(Arr::except($validated, ['member_ids']));
        $this->syncRelations($pressRelease, $request);
        $this->syncMembers($pressRelease, $validated);

        $pressRelease->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags', 'members');

        SiteRebuild::markDirty('press-releases');

        return new PressReleaseResource($pressRelease);
    }

    public function destroy(PressRelease $pressRelease): Response
    {
        $pressRelease->delete();

        SiteRebuild::markDirty('press-releases');

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
            // Who the article is about. Absent leaves them alone; [] clears them.
            'member_ids'     => 'sometimes|nullable|array',
            'member_ids.*'   => 'integer|distinct|exists:band_members,id',
        ]);
    }

    /**
     * Who the article is about. Keyed on presence: an explicit [] clears them,
     * a save that never mentions them leaves them alone. Only a real change
     * marks member pages for a rebuild.
     */
    private function syncMembers(PressRelease $pr, array $data): void
    {
        if (! array_key_exists('member_ids', $data)) {
            return;
        }
        if (array_filter($pr->members()->sync($data['member_ids'] ?? []))) {
            SiteRebuild::markDirty('band-members');
        }
    }

    private function syncRelations(PressRelease $pr, Request $request): void
    {
        $pr->concerts()->sync($request->input('concert_ids', []));

        // Guarded, unlike the others: the admin's "linked posts" picker was
        // removed once post coverage moved to reference blocks owned by the
        // post itself (see PostBlockResolver/PostBlockBackfill), so the client
        // no longer sends this key at all. Syncing unconditionally would wipe
        // every existing press_release_posts row — including rows the
        // one-time block backfill still needs to have existed — on the next
        // unrelated edit to any press release.
        if ($request->has('post_ids')) {
            $pr->posts()->sync($request->input('post_ids', []));
        }

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
