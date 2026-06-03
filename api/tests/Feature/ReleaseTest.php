<?php

use App\Models\Release;
use App\Models\ReleasePhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(function () {
    $this->createProfile();
    Storage::fake('public');
});

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

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/releases/{$release->id}", ['title' => 'Y', 'type' => 'EP'])->assertForbidden();
    });

    it('updates a release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'Old', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}", ['title' => 'Updated', 'type' => 'LP'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Updated')
            ->assertJsonPath('data.type', 'LP');
    });

    it('updates release_date field', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'Old', 'type' => 'EP', 'release_date' => '2020-01-01']);

        $this->putJson("/api/releases/{$release->id}", ['title' => 'Old', 'type' => 'EP', 'release_date' => '2025-12-01'])
            ->assertSuccessful()
            ->assertJsonPath('data.release_date', '2025-12-01');

        $this->assertDatabaseHas('releases', ['id' => $release->id, 'release_date' => '2025-12-01']);
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

    it('validates title is required', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}", ['type' => 'EP'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
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

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/releases/{$release->id}")->assertForbidden();
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

// ── POST /api/releases/{release}/cover ───────────────────────────────────────

describe('POST /api/releases/{release}/cover', function () {
    beforeEach(fn () => Storage::fake('public'));

    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->postJson("/api/releases/{$release->id}/cover", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson("/api/releases/{$release->id}/cover", [])->assertForbidden();
    });

    it('stores the cover image and updates the release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'My LP', 'type' => 'LP']);
        $file    = UploadedFile::fake()->create('cover.jpg', 100, 'image/jpeg');

        $this->postJson("/api/releases/{$release->id}/cover", ['cover' => $file])
            ->assertSuccessful();

        $release->refresh();
        expect($release->cover_image)->not->toBeNull();
        Storage::disk('public')->assertExists($release->cover_image);
    });

    it('requires an image file', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->postJson("/api/releases/{$release->id}/cover", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cover']);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('cover.jpg', 100, 'image/jpeg');

        $this->postJson('/api/releases/9999/cover', ['cover' => $file])->assertNotFound();
    });
});

// ── DELETE /api/releases/{release}/cover ─────────────────────────────────────

describe('DELETE /api/releases/{release}/cover', function () {
    beforeEach(fn () => Storage::fake('public'));

    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->deleteJson("/api/releases/{$release->id}/cover")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/releases/{$release->id}/cover")->assertForbidden();
    });

    it('clears the cover_image field', function () {
        $this->actingAsAdmin();
        $file    = UploadedFile::fake()->create('cover.jpg', 100, 'image/jpeg');
        $path    = $file->store('release-covers', 'public');
        $release = Release::create(['profile_id' => 1, 'title' => 'My LP', 'type' => 'LP', 'cover_image' => $path]);

        $this->deleteJson("/api/releases/{$release->id}/cover")
            ->assertSuccessful();

        $this->assertDatabaseHas('releases', ['id' => $release->id, 'cover_image' => null]);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/releases/9999/cover')->assertNotFound();
    });
});

// ── POST /api/releases/{release}/photos ──────────────────────────────────────

describe('POST /api/releases/{release}/photos', function () {
    beforeEach(fn () => Storage::fake('public'));

    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->postJson("/api/releases/{$release->id}/photos", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson("/api/releases/{$release->id}/photos", [])->assertForbidden();
    });

    it('attaches uploaded photos to the release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'My LP', 'type' => 'LP']);
        $file1   = UploadedFile::fake()->create('photo1.jpg', 100, 'image/jpeg');
        $file2   = UploadedFile::fake()->create('photo2.jpg', 100, 'image/jpeg');

        $this->postJson("/api/releases/{$release->id}/photos", [
            'files' => [$file1, $file2],
        ])->assertSuccessful();

        $this->assertDatabaseCount('release_photos', 2);
        $this->assertDatabaseHas('release_photos', ['release_id' => $release->id]);
    });

    it('requires a files array', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->postJson("/api/releases/{$release->id}/photos", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files']);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

        $this->postJson('/api/releases/9999/photos', ['files' => [$file]])->assertNotFound();
    });
});

// ── DELETE /api/releases/{release}/photos/{photo} ────────────────────────────

describe('DELETE /api/releases/{release}/photos/{photo}', function () {
    beforeEach(fn () => Storage::fake('public'));

    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        $photo   = ReleasePhoto::create(['release_id' => $release->id, 'image' => 'release-photos/p.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/releases/{$release->id}/photos/{$photo->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        $photo   = ReleasePhoto::create(['release_id' => $release->id, 'image' => 'release-photos/p.jpg', 'sort_order' => 0]);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/releases/{$release->id}/photos/{$photo->id}")->assertForbidden();
    });

    it('detaches the photo from the release', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'My LP', 'type' => 'LP']);
        $photo   = ReleasePhoto::create(['release_id' => $release->id, 'image' => 'release-photos/p.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/releases/{$release->id}/photos/{$photo->id}")->assertNoContent();

        $this->assertDatabaseMissing('release_photos', ['id' => $photo->id]);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/releases/9999/photos/1')->assertNotFound();
    });

    it('returns 404 for a non-existent photo', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->deleteJson("/api/releases/{$release->id}/photos/9999")->assertNotFound();
    });
});

// ── PUT /api/releases/{release}/photos/reorder ───────────────────────────────

describe('PUT /api/releases/{release}/photos/reorder', function () {
    it('returns 401 without authentication', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}/photos/reorder", ['order' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/releases/{$release->id}/photos/reorder", ['order' => []])->assertForbidden();
    });

    it('reorders photos', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'My LP', 'type' => 'LP']);
        $photo1  = ReleasePhoto::create(['release_id' => $release->id, 'image' => 'release-photos/p1.jpg', 'sort_order' => 0]);
        $photo2  = ReleasePhoto::create(['release_id' => $release->id, 'image' => 'release-photos/p2.jpg', 'sort_order' => 1]);

        $this->putJson("/api/releases/{$release->id}/photos/reorder", [
            'order' => [$photo2->id, $photo1->id],
        ])->assertSuccessful();

        expect(ReleasePhoto::find($photo2->id)->sort_order)->toBe(0);
        expect(ReleasePhoto::find($photo1->id)->sort_order)->toBe(1);
    });

    it('validates order array is required', function () {
        $this->actingAsAdmin();
        $release = Release::create(['profile_id' => 1, 'title' => 'X', 'type' => 'EP']);

        $this->putJson("/api/releases/{$release->id}/photos/reorder", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order']);
    });

    it('returns 404 for a non-existent release', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/releases/9999/photos/reorder', ['order' => []])->assertNotFound();
    });
});
