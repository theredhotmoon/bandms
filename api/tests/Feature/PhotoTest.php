<?php

use App\Models\Album;
use App\Models\Photo;

function makeAlbum(): Album
{
    return Album::create(['title' => 'Test Album', 'slug_en' => 'test-album']);
}

function makePhoto(?Album $album = null): Photo
{
    $album ??= makeAlbum();
    return Photo::create(['album_id' => $album->id, 'image' => 'photos/test.jpg', 'sort_order' => 0]);
}

// ── GET /api/photos ────────────────────────────────────────────────────────────

describe('GET /api/photos', function () {
    it('is publicly accessible without authentication', function () {
        $this->getJson('/api/photos')->assertSuccessful();
    });

    it('returns an empty list when there are no photos', function () {
        $this->getJson('/api/photos')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns all photos ordered by sort_order', function () {
        $album = makeAlbum();
        Photo::create(['album_id' => $album->id, 'image' => 'a.jpg', 'sort_order' => 2]);
        Photo::create(['album_id' => $album->id, 'image' => 'b.jpg', 'sort_order' => 1]);

        $data = $this->getJson('/api/photos')->assertSuccessful()->json('data');
        expect($data[0]['sort_order'])->toBe(1);
        expect($data[1]['sort_order'])->toBe(2);
    });
});

// ── GET /api/photos/{photo} ────────────────────────────────────────────────────

describe('GET /api/photos/{photo}', function () {
    it('is publicly accessible without authentication', function () {
        $photo = makePhoto();
        $this->getJson("/api/photos/{$photo->id}")->assertSuccessful();
    });

    it('returns the photo with its album', function () {
        $photo = makePhoto();
        $this->getJson("/api/photos/{$photo->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $photo->id);
    });

    it('returns 404 for a non-existent photo', function () {
        $this->getJson('/api/photos/99999')->assertNotFound();
    });
});

// ── PUT /api/photos/{photo} ────────────────────────────────────────────────────

describe('POST|PUT /api/photos/{photo}', function () {
    it('returns 401 without authentication', function () {
        $photo = makePhoto();
        $this->putJson("/api/photos/{$photo->id}", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $photo = makePhoto();
        $this->putJson("/api/photos/{$photo->id}", ['caption' => 'x'])->assertForbidden();
    });

    it('updates caption, sort_order and epk_featured', function () {
        $this->actingAsAdmin();
        $photo = makePhoto();

        $this->putJson("/api/photos/{$photo->id}", [
            'caption'      => 'Stage night',
            'sort_order'   => 5,
            'epk_featured' => true,
        ])->assertSuccessful()
          ->assertJsonPath('data.caption', 'Stage night')
          ->assertJsonPath('data.sort_order', 5)
          ->assertJsonPath('data.epk_featured', true);

        $this->assertDatabaseHas('photos', [
            'id'           => $photo->id,
            'caption'      => 'Stage night',
            'sort_order'   => 5,
            'epk_featured' => true,
        ]);
    });

    it('validates caption max length', function () {
        $this->actingAsAdmin();
        $photo = makePhoto();

        $this->putJson("/api/photos/{$photo->id}", ['caption' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['caption']);
    });

    it('validates sort_order is a non-negative integer', function () {
        $this->actingAsAdmin();
        $photo = makePhoto();

        $this->putJson("/api/photos/{$photo->id}", ['sort_order' => -1])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sort_order']);
    });

    it('returns 404 for a non-existent photo', function () {
        $this->actingAsAdmin();
        $this->putJson('/api/photos/99999', ['caption' => 'x'])->assertNotFound();
    });
});

// ── DELETE /api/photos/{photo} ─────────────────────────────────────────────────

describe('DELETE /api/photos/{photo}', function () {
    it('returns 401 without authentication', function () {
        $photo = makePhoto();
        $this->deleteJson("/api/photos/{$photo->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $photo = makePhoto();
        $this->deleteJson("/api/photos/{$photo->id}")->assertForbidden();
    });

    it('deletes the photo and returns 204', function () {
        $this->actingAsAdmin();
        $photo = makePhoto();

        $this->deleteJson("/api/photos/{$photo->id}")->assertNoContent();
        $this->assertDatabaseMissing('photos', ['id' => $photo->id]);
    });

    it('returns 404 for a non-existent photo', function () {
        $this->actingAsAdmin();
        $this->deleteJson('/api/photos/99999')->assertNotFound();
    });
});
