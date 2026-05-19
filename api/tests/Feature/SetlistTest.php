<?php

use App\Models\Setlist;
use App\Models\SetlistItem;
use App\Models\Song;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/songs ────────────────────────────────────────────────────────────

describe('GET /api/songs', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/songs')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/songs')->assertForbidden();
    });

    it('returns songs ordered by title', function () {
        $this->actingAsAdmin();
        Song::create(['title' => 'Zebra Song']);
        Song::create(['title' => 'Alpha Song']);

        $this->getJson('/api/songs')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'Alpha Song');
    });
});

// ── POST /api/songs ───────────────────────────────────────────────────────────

describe('POST /api/songs', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/songs', ['title' => 'Test'])->assertUnauthorized();
    });

    it('creates a song', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/songs', [
            'title'        => 'My Song',
            'duration_sec' => 210,
            'bpm'          => 140,
            'key'          => 'A minor',
            'notes'        => 'Starts with guitar intro.',
        ])->assertCreated()
          ->assertJsonPath('data.title', 'My Song')
          ->assertJsonPath('data.bpm', 140);

        $this->assertDatabaseHas('songs', ['title' => 'My Song']);
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/songs', ['bpm' => 120])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates bpm must be between 20 and 400', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/songs', ['title' => 'Test', 'bpm' => 5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bpm']);
    });
});

// ── PUT /api/songs/{song} ─────────────────────────────────────────────────────

describe('PUT /api/songs/{song}', function () {
    it('updates a song', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'Old Song']);

        $this->putJson("/api/songs/{$song->id}", ['title' => 'New Song', 'bpm' => 130])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'New Song');
    });

    it('returns 404 for a non-existent song', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/songs/9999', ['title' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/songs/{song} ──────────────────────────────────────────────────

describe('DELETE /api/songs/{song}', function () {
    it('deletes a song', function () {
        $this->actingAsAdmin();
        $song = Song::create(['title' => 'Gone Song']);

        $this->deleteJson("/api/songs/{$song->id}")->assertNoContent();

        $this->assertDatabaseMissing('songs', ['id' => $song->id]);
    });

    it('returns 404 for a non-existent song', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/songs/9999')->assertNotFound();
    });
});

// ── GET /api/setlists ─────────────────────────────────────────────────────────

describe('GET /api/setlists', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/setlists')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/setlists')->assertForbidden();
    });

    it('returns setlists', function () {
        $this->actingAsAdmin();
        Setlist::create(['name' => 'Summer Set']);

        $this->getJson('/api/setlists')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });
});

// ── POST /api/setlists ────────────────────────────────────────────────────────

describe('POST /api/setlists', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/setlists', ['name' => 'Test'])->assertUnauthorized();
    });

    it('creates a setlist', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/setlists', ['name' => 'Festival Set'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Festival Set');

        $this->assertDatabaseHas('setlists', ['name' => 'Festival Set']);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/setlists', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });
});

// ── PUT /api/setlists/{setlist} ───────────────────────────────────────────────

describe('PUT /api/setlists/{setlist}', function () {
    it('updates a setlist name', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Old Name']);

        $this->putJson("/api/setlists/{$setlist->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Name');
    });

    it('returns 404 for a non-existent setlist', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/setlists/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/setlists/{setlist} ────────────────────────────────────────────

describe('DELETE /api/setlists/{setlist}', function () {
    it('deletes a setlist', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Gone Set']);

        $this->deleteJson("/api/setlists/{$setlist->id}")->assertNoContent();

        $this->assertDatabaseMissing('setlists', ['id' => $setlist->id]);
    });

    it('returns 404 for a non-existent setlist', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/setlists/9999')->assertNotFound();
    });
});

// ── POST /api/setlists/{setlist}/items ────────────────────────────────────────

describe('POST /api/setlists/{setlist}/items', function () {
    it('adds a song to a setlist', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Live Set']);
        $song    = Song::create(['title' => 'Opening Track']);

        $this->postJson("/api/setlists/{$setlist->id}/items", ['song_id' => $song->id])
            ->assertCreated()
            ->assertJsonPath('data.song.title', 'Opening Track');

        $this->assertDatabaseHas('setlist_items', ['setlist_id' => $setlist->id, 'song_id' => $song->id]);
    });

    it('validates song_id must exist', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Set']);

        $this->postJson("/api/setlists/{$setlist->id}/items", ['song_id' => 9999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['song_id']);
    });
});

// ── PUT /api/setlists/{setlist}/items/reorder ─────────────────────────────────

describe('PUT /api/setlists/{setlist}/items/reorder', function () {
    it('reorders setlist items', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Set']);
        $songA   = Song::create(['title' => 'Song A']);
        $songB   = Song::create(['title' => 'Song B']);
        $itemA   = SetlistItem::create(['setlist_id' => $setlist->id, 'song_id' => $songA->id, 'position' => 1]);
        $itemB   = SetlistItem::create(['setlist_id' => $setlist->id, 'song_id' => $songB->id, 'position' => 2]);

        $this->putJson("/api/setlists/{$setlist->id}/items/reorder", [
            'order' => [$itemB->id, $itemA->id],
        ])->assertSuccessful()
          ->assertJsonPath('ok', true);

        expect(SetlistItem::find($itemB->id)->position)->toBe(1);
        expect(SetlistItem::find($itemA->id)->position)->toBe(2);
    });
});

// ── DELETE /api/setlists/{setlist}/items/{item} ───────────────────────────────

describe('DELETE /api/setlists/{setlist}/items/{item}', function () {
    it('removes an item from a setlist', function () {
        $this->actingAsAdmin();
        $setlist = Setlist::create(['name' => 'Set']);
        $song    = Song::create(['title' => 'Remove Me']);
        $item    = SetlistItem::create(['setlist_id' => $setlist->id, 'song_id' => $song->id, 'position' => 1]);

        $this->deleteJson("/api/setlists/{$setlist->id}/items/{$item->id}")->assertNoContent();

        $this->assertDatabaseMissing('setlist_items', ['id' => $item->id]);
    });

    it('returns 404 if item belongs to a different setlist', function () {
        $this->actingAsAdmin();
        $setlistA = Setlist::create(['name' => 'A']);
        $setlistB = Setlist::create(['name' => 'B']);
        $song     = Song::create(['title' => 'Song']);
        $item     = SetlistItem::create(['setlist_id' => $setlistB->id, 'song_id' => $song->id, 'position' => 1]);

        $this->deleteJson("/api/setlists/{$setlistA->id}/items/{$item->id}")->assertNotFound();
    });
});

// ── POST /api/setlists/import-setlistfm ──────────────────────────────────────

describe('POST /api/setlists/import-setlistfm', function () {
    it('imports a setlist from setlist.fm data', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/setlists/import-setlistfm', [
            'setlistfm_id' => 'abc123',
            'name'         => 'Imported Set',
            'event_date'   => '2025-06-15',
            'songs'        => [
                ['title' => 'Song One', 'is_encore' => false],
                ['title' => 'Song Two', 'is_encore' => true],
            ],
        ])->assertSuccessful()
          ->assertJsonPath('data.name', 'Imported Set');

        $this->assertDatabaseHas('setlists', ['name' => 'Imported Set', 'setlistfm_id' => 'abc123']);
        $this->assertDatabaseHas('songs', ['title' => 'Song One']);
        $this->assertDatabaseCount('setlist_items', 2);
    });

    it('validates setlistfm_id and name are required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/setlists/import-setlistfm', ['songs' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['setlistfm_id', 'name', 'songs']);
    });
});
