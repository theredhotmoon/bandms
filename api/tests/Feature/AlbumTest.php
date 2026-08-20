<?php

use App\Models\Album;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(fn () => Storage::fake('public'));

// ── GET /api/albums ───────────────────────────────────────────────────────────

describe('GET /api/albums', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/albums')->assertSuccessful();
    });

    it('returns albums ordered by taken_at desc', function () {
        Album::create(['title' => 'Old', 'slug_en' => 'old', 'taken_at' => '2024-01-01']);
        Album::create(['title' => 'New', 'slug_en' => 'new', 'taken_at' => '2025-01-01']);

        $this->getJson('/api/albums')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'New');
    });
});

// ── GET /api/albums/{album} ───────────────────────────────────────────────────

describe('GET /api/albums/{album}', function () {
    it('returns the album', function () {
        $album = Album::create(['title' => 'Summer Gig', 'slug_en' => 'summer-gig']);

        $this->getJson("/api/albums/{$album->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Summer Gig');
    });

    it('returns 404 for a non-existent album', function () {
        $this->getJson('/api/albums/9999')->assertNotFound();
    });
});

// ── POST /api/albums/batch ────────────────────────────────────────────────────

describe('POST /api/albums/batch', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/albums/batch', ['title' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/albums/batch', ['title' => 'Test'])->assertForbidden();
    });

    it('creates an album with uploaded photos', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

        $this->postJson('/api/albums/batch', [
            'title' => 'Summer 2025',
            'files' => [$file],
        ])->assertCreated()
          ->assertJsonPath('data.title', 'Summer 2025');

        $this->assertDatabaseHas('albums', ['title' => 'Summer 2025']);
        $this->assertDatabaseCount('photos', 1);
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

        $this->postJson('/api/albums/batch', ['files' => [$file]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates files are required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/albums/batch', ['title' => 'Test'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files']);
    });
});

// ── PUT /api/albums/{album} ───────────────────────────────────────────────────

describe('PUT /api/albums/{album}', function () {
    it('returns 401 without authentication', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);

        $this->putJson("/api/albums/{$album->id}", ['title' => 'B'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/albums/{$album->id}", ['title' => 'B'])->assertForbidden();
    });

    it('updates an album', function () {
        $this->actingAsAdmin();
        $album = Album::create(['title' => 'Old Title', 'slug_en' => 'old-title']);

        $this->putJson("/api/albums/{$album->id}", [
            'title'       => 'New Title',
            'description' => 'Updated description',
        ])->assertSuccessful()
          ->assertJsonPath('data.title', 'New Title')
          ->assertJsonPath('data.description', 'Updated description');
    });

    it('returns 404 for a non-existent album', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/albums/9999', ['title' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/albums/{album} ────────────────────────────────────────────────

describe('DELETE /api/albums/{album}', function () {
    it('returns 401 without authentication', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);

        $this->deleteJson("/api/albums/{$album->id}")->assertUnauthorized();
    });

    it('deletes an album', function () {
        $this->actingAsAdmin();
        $album = Album::create(['title' => 'Gone', 'slug_en' => 'gone']);

        $this->deleteJson("/api/albums/{$album->id}")->assertNoContent();

        $this->assertDatabaseMissing('albums', ['id' => $album->id]);
    });

    it('returns 404 for a non-existent album', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/albums/9999')->assertNotFound();
    });
});

// ── POST /api/albums/{album}/photos ──────────────────────────────────────────

describe('POST /api/albums/{album}/photos', function () {
    it('returns 401 without authentication', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);

        $this->postJson("/api/albums/{$album->id}/photos", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson("/api/albums/{$album->id}/photos", [])->assertForbidden();
    });

    it('adds photos to an album', function () {
        $this->actingAsAdmin();
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $file  = UploadedFile::fake()->create('shot.jpg', 100, 'image/jpeg');

        $this->postJson("/api/albums/{$album->id}/photos", ['files' => [$file]])
            ->assertSuccessful();

        $this->assertDatabaseCount('photos', 1);
        expect(Photo::first()->album_id)->toBe($album->id);
    });

    it('validates files are required', function () {
        $this->actingAsAdmin();
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);

        $this->postJson("/api/albums/{$album->id}/photos", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files']);
    });

    it('returns 404 for a non-existent album', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('x.jpg', 100, 'image/jpeg');

        $this->postJson('/api/albums/9999/photos', ['files' => [$file]])->assertNotFound();
    });
});

// ── PUT /api/albums/{album}/photos/reorder ────────────────────────────────────

describe('PUT /api/albums/{album}/photos/reorder', function () {
    it('returns 401 without authentication', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);

        $this->putJson("/api/albums/{$album->id}/photos/reorder", ['order' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/albums/{$album->id}/photos/reorder", ['order' => []])->assertForbidden();
    });

    it('reorders photos', function () {
        $this->actingAsAdmin();
        $album  = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $photo1 = Photo::create(['album_id' => $album->id, 'image' => 'p1.jpg', 'sort_order' => 0]);
        $photo2 = Photo::create(['album_id' => $album->id, 'image' => 'p2.jpg', 'sort_order' => 1]);

        $this->putJson("/api/albums/{$album->id}/photos/reorder", [
            'order' => [$photo2->id, $photo1->id],
        ])->assertSuccessful();

        expect(Photo::find($photo2->id)->sort_order)->toBe(0);
        expect(Photo::find($photo1->id)->sort_order)->toBe(1);
    });
});

// ── DELETE /api/albums/{album}/photos/{photo} ─────────────────────────────────

describe('DELETE /api/albums/{album}/photos/{photo}', function () {
    it('returns 401 without authentication', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $photo = Photo::create(['album_id' => $album->id, 'image' => 'photos/test.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/albums/{$album->id}/photos/{$photo->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $photo = Photo::create(['album_id' => $album->id, 'image' => 'photos/test.jpg', 'sort_order' => 0]);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/albums/{$album->id}/photos/{$photo->id}")->assertForbidden();
    });

    it('removes a photo from an album', function () {
        $this->actingAsAdmin();
        $album = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $photo = Photo::create(['album_id' => $album->id, 'image' => 'photos/test.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/albums/{$album->id}/photos/{$photo->id}")->assertNoContent();

        $this->assertDatabaseMissing('photos', ['id' => $photo->id]);
    });

    it('returns 404 if photo belongs to a different album', function () {
        $this->actingAsAdmin();
        $albumA = Album::create(['title' => 'A', 'slug_en' => 'a']);
        $albumB = Album::create(['title' => 'B', 'slug_en' => 'b']);
        $photo  = Photo::create(['album_id' => $albumB->id, 'image' => 'photos/x.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/albums/{$albumA->id}/photos/{$photo->id}")->assertNotFound();
    });
});
