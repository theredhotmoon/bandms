<?php

use App\Models\Post;
use App\Models\Tag;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/tags ─────────────────────────────────────────────────────────────

describe('GET /api/tags', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/tags')->assertSuccessful();
    });

    it('returns tags ordered by name', function () {
        Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);
        Tag::factory()->create(['name' => 'Acoustic', 'slug' => 'acoustic']);

        $this->getJson('/api/tags')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Acoustic');
    });
});

// ── GET /api/tags/{tag} ───────────────────────────────────────────────────────

describe('GET /api/tags/{tag}', function () {
    it('returns the tag', function () {
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug' => 'blues']);

        $this->getJson("/api/tags/{$tag->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.slug', 'blues');
    });

    it('returns 404 for a non-existent tag', function () {
        $this->getJson('/api/tags/9999')->assertNotFound();
    });
});

// ── POST /api/tags ────────────────────────────────────────────────────────────

describe('POST /api/tags', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/tags', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/tags', ['name' => 'Test'])->assertForbidden();
    });

    it('creates a tag and auto-generates a slug', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => 'Live Music'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Live Music')
            ->assertJsonPath('data.slug', 'live-music');
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name must be unique', function () {
        $this->actingAsAdmin();
        Tag::factory()->create(['name' => 'Metal', 'slug' => 'metal']);

        $this->postJson('/api/tags', ['name' => 'Metal'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });
});

// ── PUT /api/tags/{tag} ───────────────────────────────────────────────────────

describe('PUT /api/tags/{tag}', function () {
    it('returns 401 without authentication', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'Y'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'Y'])->assertForbidden();
    });

    it('renames a tag and updates its slug', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Old', 'slug' => 'old']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.slug', 'new-name');
    });

    it('allows keeping the same name on update', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug' => 'blues']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'Blues'])->assertSuccessful();
    });

    it('returns 404 for a non-existent tag', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/tags/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/tags/{tag} ────────────────────────────────────────────────────

describe('DELETE /api/tags/{tag}', function () {
    it('returns 401 without authentication', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/tags/{$tag->id}")->assertForbidden();
    });

    it('deletes a tag', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertNoContent();

        $this->assertDatabaseMissing('tags', ['id' => $tag->id]);
    });

    it('detaches from posts but keeps the posts', function () {
        $this->actingAsAdmin();
        $tag  = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);
        $post = Post::factory()->create();
        $post->tags()->attach($tag);

        $this->deleteJson("/api/tags/{$tag->id}")->assertNoContent();

        $this->assertDatabaseMissing('post_tag', ['tag_id' => $tag->id]);
        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    });

    it('returns 404 for a non-existent tag', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/tags/9999')->assertNotFound();
    });
});
