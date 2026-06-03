<?php

use App\Models\Song;

// ── GET /api/songs ─────────────────────────────────────────────────────────────

describe('GET /api/songs', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/songs')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->getJson('/api/songs')->assertForbidden();
    });

    it('returns an empty list when there are no songs', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/songs')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns all songs ordered alphabetically by title', function () {
        $this->actingAsAdmin();
        Song::create(['title' => 'Zebra']);
        Song::create(['title' => 'Alpha']);
        Song::create(['title' => 'Mango']);

        $data = $this->getJson('/api/songs')->assertSuccessful()->json('data');
        expect($data[0]['title'])->toBe('Alpha');
        expect($data[1]['title'])->toBe('Mango');
        expect($data[2]['title'])->toBe('Zebra');
    });
});

// ── POST /api/songs ────────────────────────────────────────────────────────────

describe('POST /api/songs', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/songs', ['title' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->postJson('/api/songs', ['title' => 'X'])->assertForbidden();
    });

    it('creates a song with only a title', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/songs', ['title' => 'Eruption'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Eruption');

        $this->assertDatabaseHas('songs', ['title' => 'Eruption']);
    });

    it('creates a song with all optional fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/songs', [
            'title'        => 'Flying',
            'duration_sec' => 183,
            'bpm'          => 120,
            'key'          => 'A minor',
            'notes'        => 'Play softly at the start',
        ])->assertCreated()
          ->assertJsonPath('data.duration_sec', 183)
          ->assertJsonPath('data.bpm', 120)
          ->assertJsonPath('data.key', 'A minor');
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/songs', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates title max length is 255', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/songs', ['title' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates duration_sec is a positive integer', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/songs', ['title' => 'X', 'duration_sec' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['duration_sec']);
    });

    it('validates bpm is within 20–400 range', function (int $bpm) {
        $this->actingAsAdmin();
        $this->postJson('/api/songs', ['title' => 'X', 'bpm' => $bpm])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bpm']);
    })->with([19, 401]);

    it('accepts bpm at the boundary values 20 and 400', function (int $bpm) {
        $this->actingAsAdmin();
        $this->postJson('/api/songs', ['title' => "BPM {$bpm}", 'bpm' => $bpm])->assertCreated();
    })->with([20, 400]);
});

// ── PUT /api/songs/{song} ──────────────────────────────────────────────────────

describe('PUT /api/songs/{song}', function () {
    it('returns 401 without authentication', function () {
        $song = Song::create(['title' => 'Test']);
        $this->putJson("/api/songs/{$song->id}", ['title' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $song = Song::create(['title' => 'Test']);
        $this->putJson("/api/songs/{$song->id}", ['title' => 'X'])->assertForbidden();
    });

    it('updates a song title', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'Old Title']);

        $this->putJson("/api/songs/{$song->id}", ['title' => 'New Title'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'New Title');

        $this->assertDatabaseHas('songs', ['id' => $song->id, 'title' => 'New Title']);
    });

    it('allows partial updates — keeps existing values unchanged', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'Keep Me', 'bpm' => 110]);

        $this->putJson("/api/songs/{$song->id}", ['notes' => 'Outro fades'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Keep Me')
            ->assertJsonPath('data.bpm', 110);
    });

    it('validates title max length on update', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'X']);

        $this->putJson("/api/songs/{$song->id}", ['title' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('returns 404 for a non-existent song', function () {
        $this->actingAsAdmin();
        $this->putJson('/api/songs/99999', ['title' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/songs/{song} ───────────────────────────────────────────────────

describe('DELETE /api/songs/{song}', function () {
    it('returns 401 without authentication', function () {
        $song = Song::create(['title' => 'Test']);
        $this->deleteJson("/api/songs/{$song->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $song = Song::create(['title' => 'Test']);
        $this->deleteJson("/api/songs/{$song->id}")->assertForbidden();
    });

    it('deletes a song and returns 204', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'Gone Song']);

        $this->deleteJson("/api/songs/{$song->id}")->assertNoContent();
        $this->assertDatabaseMissing('songs', ['id' => $song->id]);
    });

    it('returns 404 for a non-existent song', function () {
        $this->actingAsAdmin();
        $this->deleteJson('/api/songs/99999')->assertNotFound();
    });
});
