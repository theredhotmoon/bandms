<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Tag;
use App\Models\User;
use Laravel\Passport\Passport;

// 1×1 transparent PNG as base64 data URL — safe test image fixture.
const TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ── GET /api/posts ────────────────────────────────────────────────────────────

describe('GET /api/posts', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/posts')->assertSuccessful();
    });

    it('returns posts newest first', function () {
        Post::factory()->create(['title' => 'Older', 'published_at' => now()->subDays(5)]);
        Post::factory()->create(['title' => 'Newer', 'published_at' => now()]);

        $this->getJson('/api/posts')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'Newer');
    });

    it('filters by search term in title', function () {
        Post::factory()->create(['title' => 'Guitar Lessons Review']);
        Post::factory()->create(['title' => 'Drum Kit Advice']);

        $this->getJson('/api/posts?search=guitar')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Guitar Lessons Review');
    });

    it('filters by search term in a text block', function () {
        $a = Post::factory()->create(['title' => 'Post A']);
        PostBlock::factory()->for($a)->text('We talked about amplifiers')->create();
        Post::factory()->create(['title' => 'Post B']);

        $this->getJson('/api/posts?search=amplifiers')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    // Search covers any block's payload, not just text bodies — the old
    // `content` column this replaced searched the whole article regardless
    // of shape, and an embed's label or an image's caption is plain text too.
    it('filters by search term in an embed block label', function () {
        $a = Post::factory()->create(['title' => 'Post A']);
        PostBlock::factory()->for($a)->embed('https://vimeo.com/1', 'vimeo', 'Backstage soundcheck footage')->create();
        Post::factory()->create(['title' => 'Post B']);

        $this->getJson('/api/posts?search=soundcheck')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('filters by search term in an image block caption', function () {
        $a = Post::factory()->create(['title' => 'Post A']);
        $block = PostBlock::factory()->for($a)->image('post-blocks/x.webp')->create();
        $block->update(['payload' => [...$block->payload, 'caption' => ['en' => 'Recording the new single', 'pl' => null]]]);
        Post::factory()->create(['title' => 'Post B']);

        $this->getJson('/api/posts?search=recording')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('filters by tag_id', function () {
        $tag  = Tag::factory()->create(['name' => 'Live', 'slug_en' => 'live']);
        $post = Post::factory()->create(['title' => 'Live Show']);
        Post::factory()->create(['title' => 'Studio Notes']);
        $post->tags()->attach($tag);

        $this->getJson("/api/posts?tag_id={$tag->id}")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Live Show');
    });
});

// ── GET /api/posts/{post} ─────────────────────────────────────────────────────

describe('GET /api/posts/{post}', function () {
    it('returns the post with full content', function () {
        $post = Post::factory()->create(['title' => 'Detail Post', 'image' => TEST_IMAGE]);

        $this->getJson("/api/posts/{$post->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Detail Post');
    });

    it('returns 404 for a non-existent post', function () {
        $this->getJson('/api/posts/9999')->assertNotFound();
    });
});

// ── POST /api/posts ───────────────────────────────────────────────────────────

describe('POST /api/posts', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/posts', ['title' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for member role', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/posts', ['title' => 'Test'])->assertForbidden();
    });

    it('allows publisher role to create a post', function () {
        Passport::actingAs(User::factory()->create(['role' => 'publisher']));

        $this->postJson('/api/posts', ['title' => 'Publisher Post'])
            ->assertCreated();
    });

    it('creates a post with required fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', ['title' => 'Hello World'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Hello World');

        // title is a JSON column — assert via the model accessor
        expect(Post::latest('id')->first()->title)->toBe('Hello World');
    });

    it('auto-generates a slug from the title', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', ['title' => 'Hello World Post'])
            ->assertCreated()
            ->assertJsonPath('data.slug_en', 'hello-world-post');
    });

    it('creates a draft when published_at is null', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', ['title' => 'Draft Post'])
            ->assertCreated()
            ->assertJsonPath('data.published_at', null);
    });

    it('creates a post with tags', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Live', 'slug_en' => 'live']);

        $this->postJson('/api/posts', ['title' => 'Tagged Post', 'tag_ids' => [$tag->id]])
            ->assertCreated()
            ->assertJsonPath('data.tags.0.name', 'Live');
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates image must be a base64 data URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', ['title' => 'Post', 'image' => 'not-an-image'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['image']);
    });

    // postSlug() on the public site blends slug_en and slug_pl into one
    // effective namespace per locale (/pl/ serves slug_pl, falling back to
    // slug_en) — a slug_pl that collides with a *different* post's slug_en
    // would make one of them unreachable under /pl/ with no build error.
    it('rejects a slug_pl that collides with another post\'s slug_en', function () {
        $this->actingAsAdmin();
        Post::factory()->create(['slug_en' => 'shared-slug']);

        $this->postJson('/api/posts', ['title' => 'New Post', 'slug_pl' => 'shared-slug'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug_pl']);
    });

    it('rejects a slug_en that collides with another post\'s slug_pl', function () {
        $this->actingAsAdmin();
        Post::factory()->create(['slug_pl' => 'shared-slug']);

        $this->postJson('/api/posts', ['title' => 'New Post', 'slug_en' => 'shared-slug'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug_en']);
    });

});

// ── PUT /api/posts/{post} ─────────────────────────────────────────────────────

describe('PUT /api/posts/{post}', function () {
    it('returns 401 without authentication', function () {
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['title' => 'X'])->assertUnauthorized();
    });

    it('updates a post', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Old Title']);

        $this->putJson("/api/posts/{$post->id}", ['title' => 'New Title'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'New Title');
    });

    it('syncs tags on update', function () {
        $this->actingAsAdmin();
        $post   = Post::factory()->create();
        $oldTag = Tag::factory()->create(['name' => 'Old', 'slug_en' => 'old']);
        $newTag = Tag::factory()->create(['name' => 'New', 'slug_en' => 'new']);
        $post->tags()->attach($oldTag);

        $this->putJson("/api/posts/{$post->id}", ['tag_ids' => [$newTag->id]])->assertSuccessful();

        $this->assertDatabaseMissing('post_tag', ['post_id' => $post->id, 'tag_id' => $oldTag->id]);
        $this->assertDatabaseHas('post_tag', ['post_id' => $post->id, 'tag_id' => $newTag->id]);
    });

    it('returns 404 for a non-existent post', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/posts/9999', ['title' => 'X'])->assertNotFound();
    });

    it('rejects updating slug_pl to collide with another post\'s slug_en', function () {
        $this->actingAsAdmin();
        Post::factory()->create(['slug_en' => 'shared-slug']);
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['slug_pl' => 'shared-slug'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug_pl']);
    });

    it('allows a post to keep its own slug_en unchanged on update', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['slug_en' => 'keep-me']);

        $this->putJson("/api/posts/{$post->id}", ['slug_en' => 'keep-me'])
            ->assertSuccessful();
    });
});

// ── DELETE /api/posts/{post} ──────────────────────────────────────────────────

describe('DELETE /api/posts/{post}', function () {
    it('returns 401 without authentication', function () {
        $post = Post::factory()->create();

        $this->deleteJson("/api/posts/{$post->id}")->assertUnauthorized();
    });

    it('returns 403 for member role', function () {
        $post = Post::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/posts/{$post->id}")->assertForbidden();
    });

    it('deletes a post', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();

        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    });

    it('returns 404 for a non-existent post', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/posts/9999')->assertNotFound();
    });
});

// ── press coverage on a post (added 2026-08-27) ──────────────────────────────

it('exposes the publication name alongside each press release', function () {
    $profile = \App\Models\BandProfile::factory()->create();
    $post    = \App\Models\Post::factory()->create(['published_at' => now()->subDay()]);

    $press = \App\Models\PressRelease::create([
        'profile_id'    => $profile->id,
        'url'           => 'https://gazeta-ska.example/review',
        'og_title'      => 'The most exciting brass on the scene',
        'og_site_name'  => 'Gazeta Ska',
    ]);
    $post->pressReleases()->attach($press->id);

    $this->getJson("/api/posts/{$post->id}")
        ->assertOk()
        ->assertJsonPath('data.press_releases.0.site', 'Gazeta Ska')
        ->assertJsonPath('data.press_releases.0.title', 'The most exciting brass on the scene')
        ->assertJsonPath('data.press_releases.0.url', 'https://gazeta-ska.example/review');
});

// A pull quote with no attribution reads as the band quoting itself, so the host
// stands in when the scrape found no og:site_name.
it('falls back to the url host when no site name was scraped', function () {
    $profile = \App\Models\BandProfile::factory()->create();
    $post    = \App\Models\Post::factory()->create(['published_at' => now()->subDay()]);

    $press = \App\Models\PressRelease::create([
        'profile_id' => $profile->id,
        'url'        => 'https://brassbass.example/analog-revival',
        'og_title'   => 'An all-analog revival',
    ]);
    $post->pressReleases()->attach($press->id);

    $this->getJson("/api/posts/{$post->id}")
        ->assertOk()
        ->assertJsonPath('data.press_releases.0.site', 'brassbass.example');
});

it('omits press releases for a post with no coverage', function () {
    $profile = \App\Models\BandProfile::factory()->create();
    $post    = \App\Models\Post::factory()->create(['published_at' => now()->subDay()]);

    $this->getJson("/api/posts/{$post->id}")
        ->assertOk()
        ->assertJsonPath('data.press_releases', []);
});
