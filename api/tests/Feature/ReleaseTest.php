<?php

use App\Models\Release;
use App\Models\User;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/releases ─────────────────────────────────────────────────────────

describe('GET /api/releases', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/releases')->assertSuccessful();
    });

    it('returns releases ordered by release_date desc', function () {
        Release::create(['profile_id' => 1, 'title' => 'Old Album', 'type' => 'LP', 'release_date' => '2020-01-01']);
        Release::create(['profile_id' => 1, 'title' => 'New EP',    'type' => 'EP', 'release_date' => '2024-01-01']);

        $this->getJson('/api/releases')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'New EP');
    });

    it('returns empty collection when no releases exist', function () {
        $this->getJson('/api/releases')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

// ── GET /api/releases/{release} ───────────────────────────────────────────────

describe('GET /api/releases/{release}', function () {
    it('returns the release', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'Greatest Hits', 'type' => 'LP']);

        $this->getJson("/api/releases/{$release->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Greatest Hits');
    });

    it('returns 404 for a non-existent release', function () {
        $this->getJson('/api/releases/9999')->assertNotFound();
    });
});

// ── POST /api/releases ────────────────────────────────────────────────────────

describe('POST /api/releases', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/releases', ['title' => 'Test', 'type' => 'LP'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/releases', ['title' => 'Test', 'type' => 'LP'])->assertForbidden();
    });

    it('creates a release', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', [
            'title'        => 'My EP',
            'type'         => 'EP',
            'release_date' => '2025-06-01',
        ])->assertCreated()
          ->assertJsonPath('data.title', 'My EP')
          ->assertJsonPath('data.type', 'EP');

        $this->assertDatabaseHas('releases', ['title' => 'My EP', 'type' => 'EP']);
    });

    it('creates a release with streaming links', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', [
            'title' => 'EP With Links',
            'type'  => 'EP',
            'links' => [
                ['platform' => 'spotify', 'url' => 'https://open.spotify.com/album/test'],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.links.0.platform', 'spotify');
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', ['type' => 'LP'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates type is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', ['title' => 'Test'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    });

    it('validates type must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', ['title' => 'Test', 'type' => 'mixtape'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    });

    it('accepts all known release types', function (string $type) {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', ['title' => "My {$type}", 'type' => $type])
            ->assertCreated();
    })->with(['LP', 'EP', 'single', 'compilation']);

    it('validates streaming link platform must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/releases', [
            'title' => 'Test',
            'type'  => 'EP',
            'links' => [['platform' => 'myspace', 'url' => 'https://myspace.com']],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['links.0.platform']);
    });
});

// ── PUT /api/releases/{release} ───────────────────────────────────────────────

describe('PUT /api/releases/{release}', function () {
    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}", ['title' => 'Y', 'type' => 'EP'])->assertUnauthorized();
    });

    it('updates a release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'Old', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}", ['title' => 'Updated', 'type' => 'LP'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Updated')
            ->assertJsonPath('data.type', 'LP');
    });

    it('replaces streaming links on update', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'EP', 'type' => 'EP']);
        $release->links()->create(['platform' => 'spotify', 'url' => 'https://spotify.com/old']);

        $this->putJson("/api/releases/{$release->id}", [
            'title' => 'EP',
            'type'  => 'EP',
            'links' => [['platform' => 'bandcamp', 'url' => 'https://bandcamp.com/new']],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('release_links', ['platform' => 'spotify']);
        $this->assertDatabaseHas('release_links', ['platform' => 'bandcamp']);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/releases/9999', ['title' => 'X', 'type' => 'EP'])->assertNotFound();
    });
});

// ── DELETE /api/releases/{release} ────────────────────────────────────────────

describe('DELETE /api/releases/{release}', function () {
    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->deleteJson("/api/releases/{$release->id}")->assertUnauthorized();
    });

    it('deletes a release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'Gone', 'type' => 'EP']);

        $this->deleteJson("/api/releases/{$release->id}")->assertNoContent();

        $this->assertDatabaseMissing('releases', ['id' => $release->id]);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/releases/9999')->assertNotFound();
    });
});
