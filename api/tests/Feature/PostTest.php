<?php

use App\Models\Post;
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

    it('filters by search term in content', function () {
        Post::factory()->create(['title' => 'Post A', 'content' => 'We talked about amplifiers']);
        Post::factory()->create(['title' => 'Post B', 'content' => 'Nothing interesting here']);

        $this->getJson('/api/posts?search=amplifiers')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('filters by tag_id', function () {
        $tag  = Tag::factory()->create(['name' => 'Live', 'slug' => 'live']);
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
        $tag = Tag::factory()->create(['name' => 'Live', 'slug' => 'live']);

        $this->postJson('/api/posts', ['title' => 'Tagged Post', 'tag_ids' => [$tag->id]])
            ->assertCreated()
            ->assertJsonPath('data.tags.0.name', 'Live');
    });

    it('creates a post with links', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', [
            'title' => 'Post With Links',
            'links' => [
                ['type' => 'youtube', 'url' => 'https://youtube.com/watch?v=abc123'],
                ['type' => 'normal',  'url' => 'https://example.com', 'label' => 'Website'],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.links.0.type', 'youtube');
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

    it('validates link type must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', [
            'title' => 'Post',
            'links' => [['type' => 'twitter', 'url' => 'https://twitter.com/x']],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['links.0.type']);
    });

    it('validates link url must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', [
            'title' => 'Post',
            'links' => [['type' => 'normal', 'url' => 'not-a-url']],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['links.0.url']);
    });

    it('accepts all known link types', function (string $type) {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', [
            'title' => 'Post',
            'links' => [['type' => $type, 'url' => 'https://example.com']],
        ])->assertCreated();
    })->with(['youtube', 'instagram', 'facebook', 'normal']);
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

        $this->putJson("/api/posts/{$post->id}", ['title' => 'New Title', 'content' => 'New content'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'New Title');
    });

    it('replaces links on update', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        $post->links()->create(['type' => 'youtube', 'url' => 'https://youtube.com/old', 'sort_order' => 0]);

        $this->putJson("/api/posts/{$post->id}", [
            'links' => [['type' => 'instagram', 'url' => 'https://instagram.com/band']],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('post_links', ['post_id' => $post->id, 'type' => 'youtube']);
        $this->assertDatabaseHas('post_links', ['post_id' => $post->id, 'type' => 'instagram']);
    });

    it('syncs tags on update', function () {
        $this->actingAsAdmin();
        $post   = Post::factory()->create();
        $oldTag = Tag::factory()->create(['name' => 'Old', 'slug' => 'old']);
        $newTag = Tag::factory()->create(['name' => 'New', 'slug' => 'new']);
        $post->tags()->attach($oldTag);

        $this->putJson("/api/posts/{$post->id}", ['tag_ids' => [$newTag->id]])->assertSuccessful();

        $this->assertDatabaseMissing('post_tag', ['post_id' => $post->id, 'tag_id' => $oldTag->id]);
        $this->assertDatabaseHas('post_tag', ['post_id' => $post->id, 'tag_id' => $newTag->id]);
    });

    it('returns 404 for a non-existent post', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/posts/9999', ['title' => 'X'])->assertNotFound();
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
