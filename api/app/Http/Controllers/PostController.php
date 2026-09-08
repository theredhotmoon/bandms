<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Http\Resources\PostSummaryResource;
use App\Models\Post;
use App\Support\PostBlockSync;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PostController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Post::select(['id', 'title', 'slug_en', 'slug_pl', 'intro', 'published_at', 'event_date', 'created_at', 'updated_at'])
            ->with(['tags', 'blocks' => fn ($q) => $q->where('type', 'text')->orderBy('position')])
            ->when(
                $request->filled('search'),
                fn ($q) => $q->where(fn ($q) => $q
                    ->where('title', 'like', '%' . $request->search . '%')
                    ->orWhereHas('blocks', fn ($b) => $b
                        ->where('type', 'text')
                        ->where('payload', 'like', '%' . $request->search . '%'))
                )
            )
            ->when(
                $request->filled('tag_id'),
                fn ($q) => $q->whereHas('tags', fn ($q) => $q->where('tags.id', $request->tag_id))
            )
            ->orderByDesc('published_at')
            ->orderByDesc('created_at');

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
        $post = DB::transaction(function () use ($data) {
            $titleEn = is_array($data['title']) ? ($data['title']['en'] ?? reset($data['title']) ?? 'post') : $data['title'];
            $titlePl = is_array($data['title']) ? ($data['title']['pl'] ?? null) : null;

            $post = Post::create([
                'title'        => $data['title'],
                'slug_en'      => ($data['slug_en'] ?? null) ?: Post::generateSlug($titleEn, null, 'slug_en'),
                'slug_pl'      => ($data['slug_pl'] ?? null) ?: ($titlePl ? Post::generateSlug($titlePl, null, 'slug_pl') : null),
                'intro'        => $data['intro'] ?? null,
                'image'        => $data['image'] ?? null,
                'published_at' => $data['published_at'] ?? null,
                'event_date'   => $data['event_date'] ?? null,
            ]);

            if (! empty($data['tag_ids'])) {
                $post->tags()->sync($data['tag_ids']);
            }

            PostBlockSync::sync($post, $data['blocks'] ?? []);

            return $post;
        }, 3);

        // Posts are baked into the static site. PostController never called this
        // — with auto-rebuild on, the admin hides its manual button, so a save
        // had no way at all to reach the public site.
        SiteRebuild::requestIfAuto();

        return new PostResource($post->load(['tags', 'blocks']));
    }

    public function show(Post $post): PostResource
    {
        return new PostResource($post->load(['tags', 'pressReleases', 'blocks']));
    }

    public function update(UpdatePostRequest $request, Post $post): PostResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $post) {
            $post->update(Arr::except($data, ['tag_ids', 'blocks']));

            if (array_key_exists('tag_ids', $data)) {
                $post->tags()->sync($data['tag_ids'] ?? []);
            }

            if (array_key_exists('blocks', $data)) {
                PostBlockSync::sync($post, $data['blocks'] ?? []);
            }
        }, 3);

        SiteRebuild::requestIfAuto();

        return new PostResource($post->load(['tags', 'pressReleases', 'blocks']));
    }

    public function destroy(Post $post): JsonResponse
    {
        foreach (PostBlockSync::imagePaths($post->blocks()->get()->all()) as $path) {
            Storage::disk('public')->delete($path);
        }

        $post->delete();

        SiteRebuild::requestIfAuto();

        return response()->json(null, 204);
    }

    /**
     * Standalone rather than per-post: a picture block can be added to a post
     * that does not exist yet, so the upload has to happen before there is an
     * id to hang it on.
     */
    public function uploadBlockImage(Request $request): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:4096']);

        $path = $request->file('image')->store('post-blocks', 'public');

        return response()->json(['path' => $path, 'url' => Storage::url($path)], 201);
    }
}
