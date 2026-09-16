<?php

use App\Models\Post;
use App\Models\PressRelease;

/**
 * A post with no published_at is a draft: the admin lists it as "Draft" and it
 * must not reach the public site. Until Sep 2026 the public endpoints applied
 * no such filter, so every draft was built into the Astro site — the admin's
 * status column and the visitor's news page disagreed on what existed.
 *
 * The admin reads through its own routes (`/api/admin/posts`), the same split
 * FaqController uses, rather than the public ones behaving differently when a
 * token happens to be present.
 */

// ── Public ───────────────────────────────────────────────────────────────────

describe('public GET /api/posts', function () {
    it('omits drafts', function () {
        Post::factory()->published()->create(['title' => 'Live']);
        Post::factory()->draft()->create(['title' => 'Draft']);

        $this->getJson('/api/posts')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Live');
    });

    it('omits drafts from a paginated page too', function () {
        Post::factory()->published()->create();
        Post::factory()->draft()->create();

        $this->getJson('/api/posts?page=1')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1);
    });

    it('omits drafts that match a search', function () {
        Post::factory()->draft()->create(['title' => 'Secret guitar news']);

        $this->getJson('/api/posts?search=guitar')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

describe('public GET /api/posts/{post}', function () {
    it('serves a published post', function () {
        $post = Post::factory()->published()->create();

        $this->getJson("/api/posts/{$post->id}")->assertSuccessful();
    });

    // A draft's URL is indistinguishable from a URL that never existed — a 403
    // would confirm there is something there.
    it('returns 404 for a draft', function () {
        $post = Post::factory()->draft()->create();

        $this->getJson("/api/posts/{$post->id}")->assertNotFound();
    });
});

// ── Admin ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/posts', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/admin/posts')->assertUnauthorized();
    });

    it('lists drafts alongside published posts', function () {
        $this->actingAsAdmin();
        Post::factory()->published()->create(['title' => 'Live']);
        Post::factory()->draft()->create(['title' => 'Draft']);

        $this->getJson('/api/admin/posts')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });

    it('honours the same search filter as the public list', function () {
        $this->actingAsAdmin();
        Post::factory()->draft()->create(['title' => 'Secret guitar news']);
        Post::factory()->published()->create(['title' => 'Drum advice']);

        $this->getJson('/api/admin/posts?search=guitar')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Secret guitar news');
    });

    it('paginates when asked, like the public list', function () {
        $this->actingAsAdmin();
        Post::factory()->count(13)->draft()->create();

        $this->getJson('/api/admin/posts?page=2')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 13);
    });
});

describe('GET /api/admin/posts/{post}', function () {
    it('returns 401 without authentication', function () {
        $post = Post::factory()->draft()->create();

        $this->getJson("/api/admin/posts/{$post->id}")->assertUnauthorized();
    });

    it('serves a draft to the editor', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->draft()->create(['title' => 'Work in progress']);

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Work in progress')
            ->assertJsonPath('data.published_at', null);
    });
});

// ── Unpublishing ─────────────────────────────────────────────────────────────

// The admin form sends `published_at: null` when the datetime-local field is
// cleared (PostForm.vue). That has to actually unpublish — a merge that kept
// the old value would leave a post the band withdrew still on the site.
it('clears published_at when the update sends null, and the post leaves the public list', function () {
    $this->actingAsAdmin();
    $post = Post::factory()->published()->create();

    $this->putJson("/api/posts/{$post->id}", ['published_at' => null])
        ->assertSuccessful()
        ->assertJsonPath('data.published_at', null);

    expect($post->fresh()->published_at)->toBeNull();
    $this->getJson('/api/posts')->assertJsonCount(0, 'data');
    $this->getJson("/api/posts/{$post->id}")->assertNotFound();
});

it('leaves published_at alone when the update does not mention it', function () {
    $this->actingAsAdmin();
    $post = Post::factory()->published()->create();

    $this->putJson("/api/posts/{$post->id}", ['title' => 'Renamed'])->assertSuccessful();

    expect($post->fresh()->published_at)->not->toBeNull();
});

// ── Other public routes that embed posts ─────────────────────────────────────

// PressReleaseResource emits each linked post's title and slug, so a draft
// linked to a press release for later would announce itself here.
it('omits a linked draft from the public press-release detail', function () {
    $pr = PressRelease::factory()->create();
    $live = Post::factory()->published()->create(['title' => 'Live']);
    $draft = Post::factory()->draft()->create(['title' => 'Draft']);
    $pr->posts()->sync([$live->id, $draft->id]);

    $this->getJson("/api/press-releases/{$pr->id}")
        ->assertSuccessful()
        ->assertJsonCount(1, 'data.posts')
        ->assertJsonPath('data.posts.0.title', 'Live');
});
