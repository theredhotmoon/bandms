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
        Tag::factory()->create(['name' => 'Rock', 'slug_en' => 'rock']);
        Tag::factory()->create(['name' => 'Acoustic', 'slug_en' => 'acoustic']);

        $this->getJson('/api/tags')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Acoustic');
    });

    it('resolves the name for the requested locale, falling back when untranslated', function () {
        $tag = Tag::factory()->create(['name' => ['en' => 'Rock', 'pl' => 'Rock (PL)'], 'slug_en' => 'rock']);

        $this->getJson("/api/tags/{$tag->id}?lang=pl")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Rock (PL)');

        // Only 'en' was ever set for this one — 'pl' falls back rather than
        // rendering an empty pill on the public site.
        $onlyEnglish = Tag::factory()->create(['name' => 'Blues', 'slug_en' => 'blues']);

        $this->getJson("/api/tags/{$onlyEnglish->id}?lang=pl")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Blues');
    });

    it('includes the raw per-locale translations bag for the admin editor', function () {
        $tag = Tag::factory()->create(['name' => ['en' => 'Rock', 'pl' => 'Rock (PL)'], 'slug_en' => 'rock']);

        $this->getJson("/api/tags/{$tag->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.translations.name.en', 'Rock')
            ->assertJsonPath('data.translations.name.pl', 'Rock (PL)');
    });
});

// ── GET /api/tags/{tag} ───────────────────────────────────────────────────────

describe('GET /api/tags/{tag}', function () {
    it('returns the tag', function () {
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug_en' => 'blues']);

        $this->getJson("/api/tags/{$tag->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.slug_en', 'blues');
    });

    it('returns 404 for a non-existent tag', function () {
        $this->getJson('/api/tags/9999')->assertNotFound();
    });
});

// ── POST /api/tags ────────────────────────────────────────────────────────────

describe('POST /api/tags', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/tags', ['name' => ['en' => 'Test']])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/tags', ['name' => ['en' => 'Test']])->assertForbidden();
    });

    it('creates a tag and auto-generates slug_en', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['en' => 'Live Music']])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Live Music')
            ->assertJsonPath('data.slug_en', 'live-music')
            ->assertJsonPath('data.slug_pl', null);
    });

    it('also generates slug_pl when a Polish name is given', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['en' => 'Live Music', 'pl' => 'Muzyka na żywo']])
            ->assertCreated()
            ->assertJsonPath('data.slug_en', 'live-music')
            ->assertJsonPath('data.slug_pl', 'muzyka-na-zywo');
    });

    it('generates slug_en from whichever locale is filled when English is blank', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['pl' => 'Akustyczny']])
            ->assertCreated()
            ->assertJsonPath('data.slug_en', 'akustyczny');
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates a name must be filled in at least one language', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['en' => '', 'pl' => '']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en', 'name.pl']);
    });

    it('validates name.en must be unique per locale', function () {
        $this->actingAsAdmin();
        Tag::factory()->create(['name' => 'Metal', 'slug_en' => 'metal']);

        $this->postJson('/api/tags', ['name' => ['en' => 'Metal']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en']);
    });

    it('allows the same word in different locales across two tags', function () {
        $this->actingAsAdmin();
        Tag::factory()->create(['name' => ['en' => 'Live', 'pl' => 'Na żywo'], 'slug_en' => 'live']);

        $this->postJson('/api/tags', ['name' => ['en' => 'Na żywo']])
            ->assertCreated();
    });
});

// ── PUT /api/tags/{tag} ───────────────────────────────────────────────────────

describe('PUT /api/tags/{tag}', function () {
    it('returns 401 without authentication', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Y']])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Y']])->assertForbidden();
    });

    it('renames a tag and updates its slug', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Old', 'slug_en' => 'old']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'New Name']])
            ->assertSuccessful()
            ->assertJsonPath('data.slug_en', 'new-name');
    });

    it('allows keeping the same name on update', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug_en' => 'blues']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Blues']])->assertSuccessful();
    });

    it('updates only the given locale, leaving the other untouched', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => ['en' => 'Rock', 'pl' => 'Rock (PL)'], 'slug_en' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Rock Music']])
            ->assertSuccessful()
            ->assertJsonPath('data.translations.name.en', 'Rock Music')
            ->assertJsonPath('data.translations.name.pl', 'Rock (PL)');
    });

    it('clears one locale via an explicit empty string without wiping the other', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => ['en' => 'Rock', 'pl' => 'Rock (PL)'], 'slug_en' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Rock', 'pl' => '']])
            ->assertSuccessful()
            ->assertJsonPath('data.translations.name.pl', null)
            ->assertJsonPath('data.slug_pl', null);
    });

    it('returns 404 for a non-existent tag', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/tags/9999', ['name' => ['en' => 'X']])->assertNotFound();
    });
});

// ── DELETE /api/tags/{tag} ────────────────────────────────────────────────────

describe('DELETE /api/tags/{tag}', function () {
    it('returns 401 without authentication', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tag = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/tags/{$tag->id}")->assertForbidden();
    });

    it('deletes a tag', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertNoContent();

        $this->assertDatabaseMissing('tags', ['id' => $tag->id]);
    });

    it('detaches from posts but keeps the posts', function () {
        $this->actingAsAdmin();
        $tag  = Tag::factory()->create(['name' => 'X', 'slug_en' => 'x']);
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
