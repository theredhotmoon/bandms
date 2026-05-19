<?php

use App\Models\Author;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/authors ──────────────────────────────────────────────────────────

describe('GET /api/authors', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/authors')->assertSuccessful();
    });

    it('returns authors ordered by name', function () {
        Author::create(['name' => 'Zara Jones']);
        Author::create(['name' => 'Alice Smith']);

        $this->getJson('/api/authors')
            ->assertSuccessful()
            ->assertJsonPath('data.0.name', 'Alice Smith');
    });
});

// ── GET /api/authors/{author} ─────────────────────────────────────────────────

describe('GET /api/authors/{author}', function () {
    it('returns the author', function () {
        $author = Author::create(['name' => 'Bob Brown', 'email' => 'bob@music.com']);

        $this->getJson("/api/authors/{$author->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Bob Brown')
            ->assertJsonPath('data.email', 'bob@music.com');
    });

    it('returns 404 for a non-existent author', function () {
        $this->getJson('/api/authors/9999')->assertNotFound();
    });
});

// ── POST /api/authors ─────────────────────────────────────────────────────────

describe('POST /api/authors', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/authors', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/authors', ['name' => 'Test'])->assertForbidden();
    });

    it('creates an author with required fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['name' => 'Jane Journalist'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Jane Journalist');

        $this->assertDatabaseHas('authors', ['name' => 'Jane Journalist']);
    });

    it('creates an author with all contact fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', [
            'name'      => 'Full Contact',
            'email'     => 'full@press.com',
            'phone'     => '+48 123 456 789',
            'whatsapp'  => '+48 123 456 789',
            'facebook'  => 'https://facebook.com/full',
            'instagram' => 'fullcontact',
            'notes'     => 'Met at a festival.',
        ])->assertCreated()
          ->assertJsonPath('data.email', 'full@press.com')
          ->assertJsonPath('data.notes', 'Met at a festival.');
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['email' => 'no-name@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates email must be a valid email address', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['name' => 'Test', 'email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });
});

// ── PUT /api/authors/{author} ─────────────────────────────────────────────────

describe('PUT /api/authors/{author}', function () {
    it('returns 401 without authentication', function () {
        $author = Author::create(['name' => 'A']);

        $this->putJson("/api/authors/{$author->id}", ['name' => 'B'])->assertUnauthorized();
    });

    it('updates an author', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Old Name', 'notes' => 'Old note']);

        $this->putJson("/api/authors/{$author->id}", ['name' => 'New Name', 'notes' => 'Updated note'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.notes', 'Updated note');
    });

    it('returns 404 for a non-existent author', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/authors/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/authors/{author} ──────────────────────────────────────────────

describe('DELETE /api/authors/{author}', function () {
    it('returns 401 without authentication', function () {
        $author = Author::create(['name' => 'A']);

        $this->deleteJson("/api/authors/{$author->id}")->assertUnauthorized();
    });

    it('deletes an author', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Gone Author']);

        $this->deleteJson("/api/authors/{$author->id}")->assertNoContent();

        $this->assertDatabaseMissing('authors', ['id' => $author->id]);
    });

    it('returns 404 for a non-existent author', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/authors/9999')->assertNotFound();
    });
});
