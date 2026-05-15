<?php

namespace App\Http\Controllers;

use App\Http\Resources\PostResource;
use App\Http\Resources\PostSummaryResource;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;

class PostController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $posts = Post::select(['id', 'title', 'slug', 'content', 'published_at', 'created_at', 'updated_at'])
            ->with(['tags'])
            ->when(
                $request->filled('search'),
                fn ($q) => $q->where(fn ($q) => $q
                    ->where('title', 'like', '%' . $request->search . '%')
                    ->orWhere('content', 'like', '%' . $request->search . '%')
                )
            )
            ->when(
                $request->filled('tag_id'),
                fn ($q) => $q->whereHas('tags', fn ($q) => $q->where('tags.id', $request->tag_id))
            )
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->get();

        return PostSummaryResource::collection($posts);
    }

    public function store(Request $request): PostResource
    {
        $data = $request->validate([
            'title'          => 'required|string|max:255',
            'intro'          => 'nullable|string|max:1000',
            'content'        => 'nullable|string',
            'image'          => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'published_at'   => 'nullable|date',
            'tag_ids'        => 'nullable|array',
            'tag_ids.*'      => 'integer|exists:tags,id',
            'concert_ids'    => 'nullable|array',
            'concert_ids.*'  => 'integer|exists:concerts,id',
            'album_ids'      => 'nullable|array',
            'album_ids.*'    => 'integer|exists:albums,id',
            'release_ids'    => 'nullable|array',
            'release_ids.*'  => 'integer|exists:releases,id',
            'tour_ids'       => 'nullable|array',
            'tour_ids.*'     => 'integer|exists:tours,id',
            'links'          => 'nullable|array',
            'links.*.type'   => ['required', 'string', 'in:youtube,instagram,facebook,normal'],
            'links.*.url'    => 'required|string|url|max:2048',
            'links.*.label'  => 'nullable|string|max:255',
        ]);

        $post = Post::create([
            'title'        => $data['title'],
            'slug'         => Post::generateSlug($data['title']),
            'intro'        => $data['intro'] ?? null,
            'content'      => $data['content'] ?? null,
            'image'        => $data['image'] ?? null,
            'published_at' => $data['published_at'] ?? null,
        ]);

        if (!empty($data['tag_ids']))      $post->tags()->sync($data['tag_ids']);
        if (!empty($data['concert_ids'])) $post->concerts()->sync($data['concert_ids']);
        if (!empty($data['album_ids']))   $post->albums()->sync($data['album_ids']);
        if (!empty($data['release_ids'])) $post->releases()->sync($data['release_ids']);
        if (!empty($data['tour_ids']))    $post->tours()->sync($data['tour_ids']);

        if (!empty($data['links'])) {
            $post->links()->createMany(
                array_map(fn ($link, $i) => [...$link, 'sort_order' => $i], $data['links'], array_keys($data['links']))
            );
        }

        return new PostResource($post->load(['tags', 'links', 'concerts', 'albums', 'releases', 'tours']));
    }

    public function show(Post $post): PostResource
    {
        return new PostResource($post->load(['tags', 'links', 'concerts.venue', 'albums', 'releases', 'tours']));
    }

    public function update(Request $request, Post $post): PostResource
    {
        $data = $request->validate([
            'title'          => 'sometimes|required|string|max:255',
            'intro'          => 'nullable|string|max:1000',
            'content'        => 'nullable|string',
            'image'          => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'published_at'   => 'nullable|date',
            'tag_ids'        => 'nullable|array',
            'tag_ids.*'      => 'integer|exists:tags,id',
            'concert_ids'    => 'nullable|array',
            'concert_ids.*'  => 'integer|exists:concerts,id',
            'album_ids'      => 'nullable|array',
            'album_ids.*'    => 'integer|exists:albums,id',
            'release_ids'    => 'nullable|array',
            'release_ids.*'  => 'integer|exists:releases,id',
            'tour_ids'       => 'nullable|array',
            'tour_ids.*'     => 'integer|exists:tours,id',
            'links'          => 'nullable|array',
            'links.*.type'   => ['required', 'string', 'in:youtube,instagram,facebook,normal'],
            'links.*.url'    => 'required|string|url|max:2048',
            'links.*.label'  => 'nullable|string|max:255',
        ]);

        $post->update(Arr::except($data, ['tag_ids', 'concert_ids', 'album_ids', 'release_ids', 'tour_ids', 'links']));

        if (array_key_exists('tag_ids', $data))      $post->tags()->sync($data['tag_ids'] ?? []);
        if (array_key_exists('concert_ids', $data))  $post->concerts()->sync($data['concert_ids'] ?? []);
        if (array_key_exists('album_ids', $data))    $post->albums()->sync($data['album_ids'] ?? []);
        if (array_key_exists('release_ids', $data))  $post->releases()->sync($data['release_ids'] ?? []);
        if (array_key_exists('tour_ids', $data))     $post->tours()->sync($data['tour_ids'] ?? []);

        if (array_key_exists('links', $data)) {
            $post->links()->delete();
            if (!empty($data['links'])) {
                $post->links()->createMany(
                    array_map(fn ($link, $i) => [...$link, 'sort_order' => $i], $data['links'], array_keys($data['links']))
                );
            }
        }

        return new PostResource($post->load(['tags', 'links', 'concerts.venue', 'albums', 'releases', 'tours']));
    }

    public function destroy(Post $post): JsonResponse
    {
        $post->delete();

        return response()->json(null, 204);
    }
}
