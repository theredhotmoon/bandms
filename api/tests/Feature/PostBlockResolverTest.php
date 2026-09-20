<?php

use App\Models\Concert;
use App\Models\Post;
use App\Models\PostBlock;
use App\Models\PressRelease;
use App\Models\Release;
use App\Support\PostBlockResolver;

it('resolves a concert ref to its identity fields', function () {
    $concert = Concert::factory()->create(['slug_en' => 'gig-at-the-club']);
    $post    = Post::factory()->create();
    $block   = PostBlock::factory()->for($post)->ref('concert', $concert->id)->create();

    $resolved = PostBlockResolver::resolve(collect([$block]));

    expect($resolved[$block->id]['id'])->toBe($concert->id);
    expect($resolved[$block->id]['slug_en'])->toBe('gig-at-the-club');
});

// A dangling ref must resolve, not explode. The Astro build is all-or-nothing:
// one page that throws aborts all 35 and the web container crash-loops.
it('resolves a deleted entity to null instead of throwing', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('release', 999999)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});

it('resolves an unknown entity name to null', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('tour', 1)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});

it('ignores non-ref blocks', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->text('Hello')->create();

    expect(PostBlockResolver::resolve(collect([$block])))->toBe([]);
});

// One query per entity type, not one per block. PostDetail.astro walks every
// page of the post index on every article page, so an N+1 here multiplies
// across the whole static build.
it('issues one query per entity type regardless of block count', function () {
    $post     = Post::factory()->create();
    $releases = Release::factory()->count(5)->create();
    $blocks   = $releases->map(fn ($r) => PostBlock::factory()->for($post)->ref('release', $r->id)->create());

    DB::enableQueryLog();
    PostBlockResolver::resolve(collect($blocks));
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($count)->toBe(1);
});

// "a quote with no source reads as the band quoting itself" — article-press.spec.ts
// asserts the attribution is never blank.
it('falls back to the url host when a press release has no og_site_name', function () {
    $pr    = PressRelease::factory()->create(['url' => 'https://pitchfork.com/x', 'og_site_name' => null]);
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('press_release', $pr->id)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id]['site'])->toBe('pitchfork.com');
});

it('resolves a clip ref with its embed fields and first concert', function () {
    $concert = Concert::factory()->create(['slug_en' => 'clip-gig']);
    $clip    = \App\Models\Clip::factory()->create(['title' => ['en' => 'Encore'], 'category' => 'live']);
    $clip->concerts()->attach($concert->id, ['position' => 0]);
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', $clip->id)->create();

    $data = PostBlockResolver::resolve(collect([$block]))[$block->id];

    expect($data['provider'])->toBe('youtube');
    expect($data['embed_id'])->toBe('dQw4w9WgXcQ');
    expect($data['title'])->toBe('Encore');
    expect($data['category'])->toBe('live');
    expect($data['concert']['slug_en'])->toBe('clip-gig');
    expect($data['concert']['venue']['name'])->toBe($concert->venue->name);
});

it('resolves a clip with no concert to a null concert, not a missing key', function () {
    $clip  = \App\Models\Clip::factory()->create();
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', $clip->id)->create();

    $data = PostBlockResolver::resolve(collect([$block]))[$block->id];

    expect($data)->toHaveKey('concert');
    expect($data['concert'])->toBeNull();
});

it('resolves a deleted clip to null', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', 999999)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});

// morphedByMany has no ORDER BY of its own, so an unordered ->first() would
// caption an arbitrary concert. Deliberately attach the *higher*-id concert
// at pivot position 0 — this only passes when position, not insertion/id
// order, drives the pick.
it('picks the concert at pivot position 0, not the lowest id', function () {
    $lower  = Concert::factory()->create();
    $higher = Concert::factory()->create();
    expect($higher->id)->toBeGreaterThan($lower->id);

    $clip = \App\Models\Clip::factory()->create();
    $clip->concerts()->attach([$higher->id => ['position' => 0], $lower->id => ['position' => 1]]);

    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', $clip->id)->create();

    $data = PostBlockResolver::resolve(collect([$block]))[$block->id];

    expect($data['concert']['id'])->toBe($higher->id);
});

// One query per entity type, not one per block — the clip arm eager-loads
// pivot+concerts and venue, but that's still a fixed number regardless of
// how many clip blocks are resolved.
it('issues a fixed number of queries for the clip entity regardless of block count', function () {
    $post   = Post::factory()->create();
    $clips  = \App\Models\Clip::factory()->count(5)->create();
    $clips->each(fn ($c) => $c->concerts()->attach(Concert::factory()->create()->id, ['position' => 0]));
    $blocks = $clips->map(fn ($c) => PostBlock::factory()->for($post)->ref('clip', $c->id)->create());

    DB::enableQueryLog();
    PostBlockResolver::resolve(collect($blocks));
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($count)->toBe(3);
});
