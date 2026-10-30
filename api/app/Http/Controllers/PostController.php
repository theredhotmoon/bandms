<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Http\Resources\PostSummaryResource;
use App\Models\Post;
use App\Support\ContentLocales;
use App\Support\Locales;
use App\Support\PostBlockSync;
use App\Support\SiteRebuild;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PostController extends Controller
{
    /**
     * Raster formats only. `image` alone admits SVG, which is served inline
     * from the public origin and can carry a script.
     */
    private const IMAGE_RULES = ['mimes:jpg,jpeg,png,gif,webp', 'max:4096'];

    /**
     * Public list — published posts only. Drafts (null published_at) never
     * reach the Astro build, which is what reads this.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'limit'   => ['sometimes', 'integer', 'min:1', 'max:50'],
            'exclude' => ['sometimes', 'integer'],
            'built_at' => ['sometimes', 'date'],
        ]);

        return $this->listResponse(
            $request,
            $this->listQuery($request, withImage: true)
                ->published()
                // The post on top of the News page, which the grid must not
                // repeat — the public site passes whatever featured() gave it.
                ->when($request->filled('exclude'), fn ($q) => $q->whereKeyNot((int) $request->exclude))
                // When the public site was built. A post created or published
                // after it has no article page yet, so a card linking to it
                // would 404 until the next rebuild — leave it out until then.
                // "Published after" is a published_at between the build and
                // now; one still in the future was published before the build
                // (published_at is a switch, not a timer — see CLAUDE.md), so
                // its page exists and it stays.
                ->when($request->filled('built_at'), function ($q) use ($request) {
                    $at = Carbon::parse($request->built_at)->setTimezone(config('app.timezone'));
                    $q->where('created_at', '<=', $at)
                        ->where(fn ($q) => $q->where('published_at', '<=', $at)->orWhere('published_at', '>', now()));
                }),
        );
    }

    /**
     * The post at the top of the News page: the one the band highlighted,
     * else the newest. `data` is null when nothing is published. One post,
     * decided once per build, so it stays put whatever a visitor filters.
     */
    public function featured(Request $request): JsonResponse
    {
        $post = $this->listQuery(new Request(), withImage: true)
            ->published()
            ->reorder()
            ->orderByDesc('is_highlighted')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->first();

        return response()->json(['data' => $post ? (new PostSummaryResource($post))->resolve($request) : null]);
    }

    /**
     * Pin a post to the top of the News page, or unpin it. One at a time:
     * pinning clears whichever post held it, in the same transaction. A
     * draft cannot be pinned — the public site would never show it, and the
     * band would wonder why the top post did not change.
     */
    public function highlight(Request $request, Post $post): JsonResponse
    {
        $on = $request->validate(['highlighted' => ['required', 'boolean']])['highlighted'];

        if ($on && $post->published_at === null) {
            throw ValidationException::withMessages(['highlighted' => __('api.highlight_draft')]);
        }

        // Set, then clear the rest — in that order. Two concurrent pins
        // that cleared first could each miss the other's uncommitted row and
        // both commit, leaving two pinned posts. This way the second clear has
        // to wait on the first's locked row; InnoDB breaks the resulting
        // deadlock, and the retry re-runs the loser after the winner commits.
        DB::transaction(function () use ($post, $on) {
            // A query, not $post->save(): after a deadlock rollback the model
            // still believes the flag is set, so a retried save() would be a
            // no-op and the retry would clear every pin, its own included.
            Post::whereKey($post->id)->update(['is_highlighted' => (bool) $on]);
            if ($on) {
                Post::whereKeyNot($post->id)->where('is_highlighted', true)->update(['is_highlighted' => false]);
            }
        }, 3);

        SiteRebuild::markDirty('posts');

        return response()->json(['data' => ['id' => $post->id, 'is_highlighted' => (bool) $on]]);
    }

    /**
     * Admin list — every post, draft or not, with the same filters and paging
     * as the public list. Its own route rather than the public one behaving
     * differently when a token is present (the FaqController::adminIndex
     * split), so an anonymous admin call can never quietly hide drafts.
     */
    public function adminIndex(Request $request): AnonymousResourceCollection
    {
        // The admin list now shows whether a post has a cover image and which
        // languages it is missing; the flag tells the summary resource to
        // emit the second, which the public list has no use for.
        $request->attributes->set(PostSummaryResource::ADMIN_LIST, true);

        return $this->listResponse($request, $this->listQuery($request, withImage: true));
    }

    /**
     * The explicit select keeps the column list deliberate; `image` is opted
     * into by both lists (the public cards render it, the admin list flags a
     * post without one). The summary resource emits it only when loaded.
     */
    private function listQuery(Request $request, bool $withImage = false): Builder
    {
        $columns = ['id', 'title', 'slug', 'intro', 'published_at', 'event_date_display', 'is_highlighted', 'created_at', 'updated_at'];
        if ($withImage) {
            $columns[] = 'image';
        }

        return Post::select($columns)
            ->with(['tags', 'concerts:id,date', 'blocks' => fn ($q) => $q->where('type', 'text')->orderBy('position')])
            ->when(
                $request->filled('search'),
                // Title, intro and every block's text — see applySearch().
                fn ($q) => $this->applySearch($q, (string) $request->search)
            )
            ->when(
                $request->filled('tag_id'),
                fn ($q) => $q->whereHas('tags', fn ($q) => $q->where('tags.id', $request->tag_id))
            )
            ->orderByDesc('published_at')
            ->orderByDesc('created_at');
    }

    /**
     * Title, intro (in the response's language and its fallbacks — what the
     * card shows) and any block's payload, ignoring case.
     *
     * The columns are JSON, and MySQL compares a JSON value as utf8mb4_bin:
     * a plain LIKE was case-sensitive and ran over every locale's text and
     * the keys, so "tour" missed "Summer Tour" and "en" matched every post.
     * That went unseen while the public search ran in the browser; it runs
     * here now. SQLite (the test stage) ignores case either way, which is why
     * the lowercasing is explicit rather than left to the collation.
     *
     * `%` and `_` in the term are literal. '!' is the escape character
     * because it means the same in MySQL and SQLite string literals, where a
     * backslash does not.
     */
    private function applySearch(Builder $query, string $search): Builder
    {
        $term = '%' . strtr(mb_strtolower($search), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
        $grammar = $query->getQuery()->getGrammar();
        $like = fn (string $column) => 'LOWER(' . $grammar->wrap($column) . ") LIKE ? ESCAPE '!'";

        $locales = Locales::chain(app()->getLocale());

        return $query->where(function ($q) use ($like, $term, $locales) {
            foreach ($locales as $code) {
                $q->orWhereRaw($like("title->{$code}"), [$term])
                    // The public News search matched title and intro when it
                    // ran in the browser, so intro stays in.
                    ->orWhereRaw($like("intro->{$code}"), [$term]);
            }
            // Any block, not just type=text: an embed's label and URL and an image's
            // alt/caption are text too, and the old `content` column this
            // replaced covered the whole body. Field by field, not the whole
            // payload, whose keys ("body", "en") would match every post.
            $q->orWhereHas('blocks', function ($b) use ($like, $term, $locales) {
                $b->where(function ($b) use ($like, $term, $locales) {
                    foreach ($locales as $code) {
                        foreach (['body', 'alt', 'caption', 'label'] as $field) {
                            $b->orWhereRaw($like("payload->{$field}->{$code}"), [$term]);
                        }
                    }
                    // Untranslated: searching "youtube" or a video id finds the post.
                    $b->orWhereRaw($like('payload->url'), [$term]);
                });
            });
        });
    }

    private function listResponse(Request $request, Builder $query): AnonymousResourceCollection
    {
        // `limit` is the public News page's "Show more": a cursor (the last
        // post shown) rather than a page number, so a post published after
        // the site was built cannot shift the batches into a repeat or a
        // skip. The order needs a unique last column for that, hence id.
        if ($request->filled('limit')) {
            $posts = $query->reorder()
                ->orderByDesc('published_at')
                ->orderByDesc('id')
                ->cursorPaginate((int) $request->limit)
                ->withQueryString();

            return PostSummaryResource::collection($posts);
        }

        $posts = $request->filled('page')
            ? $query->paginate(12)
            : $query->get();

        return PostSummaryResource::collection($posts);
    }

    public function store(StorePostRequest $request): PostResource
    {
        $data = $request->validated();

        // Retries on a MySQL deadlock (SQLSTATE 40001), which InnoDB can raise
        // between two unrelated concurrent inserts into post_blocks — this
        // transaction is exactly the shape that provokes it, and Laravel's
        // built-in retry is the standard fix rather than surfacing it as a 500.
        $membersChanged = false;
        $post = DB::transaction(function () use ($data, &$membersChanged) {
            $titles = is_array($data['title']) ? $data['title'] : [Locales::default() => $data['title']];

            // Every titled locale gets a slug on create, from its own title —
            // a post's URL is per language (/pl/ serves the Polish slug).
            $post = new Post([
                'title'        => $data['title'],
                'intro'        => $data['intro'] ?? null,
                'image'        => $data['image'] ?? null,
                'published_at' => $data['published_at'] ?? null,
                'event_date_display' => $data['event_date_display'] ?? 'range',
            ]);
            $post->applySlugBag(
                $data['slug'] ?? null,
                ContentLocales::firstFilled($titles, Locales::default()) ?? 'post',
                $titles,
            );
            $post->save();

            if (! empty($data['tag_ids'])) {
                $post->tags()->sync($data['tag_ids']);
            }

            if (! empty($data['concert_ids'])) {
                $post->concerts()->sync($data['concert_ids']);
            }

            if (! empty($data['member_ids'])) {
                $membersChanged = (bool) array_filter($post->members()->sync($data['member_ids']));
            }

            PostBlockSync::sync($post, $data['blocks'] ?? []);

            return $post;
        }, 3);

        // Posts are baked into the static site. PostController never called this
        // — with auto-rebuild on, the admin hides its manual button, so a save
        // had no way at all to reach the public site.
        SiteRebuild::markDirty('posts');
        // Member pages list the news they are linked to — only a changed set
        // of links touches them (the form always sends member_ids).
        if ($membersChanged) {
            SiteRebuild::markDirty('band-members');
        }

        return new PostResource($post->load(['tags', 'concerts', 'pressReleases', 'blocks', 'members']));
    }

    /**
     * Public detail. A draft 404s — indistinguishable from a post that never
     * existed, so the URL confirms nothing.
     */
    public function show(Post $post): PostResource
    {
        abort_if($post->published_at === null, 404);

        return $this->adminShow($post);
    }

    /** Admin detail — drafts included; what the editor loads. */
    public function adminShow(Post $post): PostResource
    {
        return new PostResource($post->load(['tags', 'concerts', 'pressReleases', 'blocks', 'members']));
    }

    public function update(UpdatePostRequest $request, Post $post): PostResource
    {
        $data = $request->validated();

        $membersChanged = false;
        $replacedImage = null;
        DB::transaction(function () use ($data, $post, &$membersChanged, &$replacedImage) {
            // Validated as nullable (a client may send it only when 2+ concerts
            // are linked), but the column itself is NOT NULL — an explicit null
            // would otherwise reach the database as a constraint violation.
            if (array_key_exists('event_date_display', $data) && $data['event_date_display'] === null) {
                $data['event_date_display'] = 'range';
            }

            // A replaced or cleared main image loses its file — after the
            // commit, so a rollback cannot leave the row pointing at nothing.
            // An omitted key leaves both alone, which is how the admin resends
            // an unchanged post.
            if (array_key_exists('image', $data) && $post->image && $post->image !== $data['image']) {
                $replacedImage = $post->image;
            }

            // Slugs through applySlugBag(): update() wrote the raw columns, so a
            // payload carrying slug_en: null nulled the post's slug.
            $post->fill(Arr::except($data, ['tag_ids', 'concert_ids', 'blocks', 'slug']));
            // A draft cannot hold the top of the News page (highlight()), so
            // unpublishing gives it up rather than keeping a pin no one sees.
            if ($post->published_at === null) {
                $post->is_highlighted = false;
            }
            if (array_key_exists('slug', $data)) {
                $post->applySlugBag($data['slug'], ContentLocales::firstFilled($post->getTranslations('title'), Locales::default()));
            }
            $post->save();

            if (array_key_exists('tag_ids', $data)) {
                $post->tags()->sync($data['tag_ids'] ?? []);
            }

            if (array_key_exists('concert_ids', $data)) {
                $post->concerts()->sync($data['concert_ids'] ?? []);
            }

            if (array_key_exists('member_ids', $data)) {
                $membersChanged = (bool) array_filter($post->members()->sync($data['member_ids'] ?? []));
            }

            if (array_key_exists('blocks', $data)) {
                PostBlockSync::sync($post, $data['blocks'] ?? []);
            }
        }, 3);

        if ($replacedImage) {
            Storage::disk('public')->delete($replacedImage);
        }

        SiteRebuild::markDirty('posts');
        // Member pages list the news they are linked to — only a changed set
        // of links touches them (the form always sends member_ids).
        if ($membersChanged) {
            SiteRebuild::markDirty('band-members');
        }

        return new PostResource($post->load(['tags', 'concerts', 'pressReleases', 'blocks', 'members']));
    }

    public function destroy(Post $post): JsonResponse
    {
        // Files go after the row: a delete that fails must not leave a post
        // whose pictures are already gone.
        $paths = PostBlockSync::imagePaths($post->blocks()->get()->all());
        if ($post->image) {
            $paths[] = $post->image;
        }

        $post->delete();

        foreach ($paths as $path) {
            Storage::disk('public')->delete($path);
        }

        SiteRebuild::markDirty('posts');

        return response()->json(null, 204);
    }

    /**
     * Standalone rather than per-post: a picture block can be added to a post
     * that does not exist yet, so the upload has to happen before there is an
     * id to hang it on.
     */
    public function uploadBlockImage(Request $request): JsonResponse
    {
        $request->validate(['image' => ['required', 'image', ...self::IMAGE_RULES]]);

        $path = $request->file('image')->store('post-blocks', 'public');

        return response()->json(['path' => $path, 'url' => Storage::url($path)], 201);
    }

    /**
     * The post's main image, uploaded ahead of the post for the same reason
     * as a block image. The returned `path` is what store/update accept in
     * `image`; `url` is for the editor's preview only.
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate(['image' => ['required', 'image', ...self::IMAGE_RULES]]);

        $path = $request->file('image')->store('post-images', 'public');

        return response()->json(['path' => $path, 'url' => Storage::url($path)], 201);
    }
}
