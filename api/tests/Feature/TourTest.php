<?php

use App\Models\Concert;
use App\Models\Tour;
use App\Models\User;
use App\Models\Venue;
use Laravel\Passport\Passport;

// ── GET /api/tours ────────────────────────────────────────────────────────────

describe('GET /api/tours', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/tours')->assertSuccessful();
    });

    it('returns an empty list when there are no tours', function () {
        $this->getJson('/api/tours')
            ->assertSuccessful()
            ->assertJsonPath('data', []);
    });

    it('returns tours ordered by start_date desc', function () {
        Tour::create(['name' => 'Old Tour', 'start_date' => '2020-01-01', 'end_date' => '2020-02-01']);
        Tour::create(['name' => 'New Tour', 'start_date' => '2025-01-01', 'end_date' => '2025-02-01']);

        $this->getJson('/api/tours')
            ->assertSuccessful()
            ->assertJsonPath('data.0.name', 'New Tour');
    });

    it('includes concerts_count in the summary', function () {
        Tour::create(['name' => 'Count Tour']);

        $this->getJson('/api/tours')
            ->assertSuccessful()
            ->assertJsonPath('data.0.concerts_count', 0);
    });
});

// ── GET /api/tours/{tour} ─────────────────────────────────────────────────────

describe('GET /api/tours/{tour}', function () {
    it('returns the tour', function () {
        $tour = Tour::create(['name' => 'Summer Ska Tour']);

        $this->getJson("/api/tours/{$tour->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Summer Ska Tour');
    });

    it('returns 404 for a non-existent tour', function () {
        $this->getJson('/api/tours/9999')->assertNotFound();
    });

    it('includes images and links in the response', function () {
        $tour = Tour::create(['name' => 'Media Tour']);
        $tour->images()->create(['url' => 'https://example.com/img.jpg', 'caption' => 'Cover', 'sort_order' => 0]);
        $tour->links()->create(['label' => 'Tickets', 'url' => 'https://example.com/tickets']);

        $this->getJson("/api/tours/{$tour->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.images.0.url', 'https://example.com/img.jpg')
            ->assertJsonPath('data.links.0.label', 'Tickets');
    });

    it('includes concerts with venue in the response', function () {
        $venue  = Venue::factory()->create(['name' => 'Big Arena']);
        $tour   = Tour::create(['name' => 'Arena Tour']);
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2025-09-01']);
        $tour->concerts()->attach($concert);

        $this->getJson("/api/tours/{$tour->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.concerts.0.venue_name', 'Big Arena');
    });
});

// ── POST /api/tours ───────────────────────────────────────────────────────────

describe('POST /api/tours', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/tours', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/tours', ['name' => 'Test'])->assertForbidden();
    });

    it('creates a tour', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'       => 'Euro Tour 2025',
            'start_date' => '2025-06-01',
            'end_date'   => '2025-07-31',
        ])->assertCreated()
          ->assertJsonPath('data.name', 'Euro Tour 2025');

        $this->assertDatabaseHas('tours', ['name' => 'Euro Tour 2025']);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name max length of 255 characters', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', ['name' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates end_date must be after or equal to start_date', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'       => 'Bad Dates',
            'start_date' => '2025-07-01',
            'end_date'   => '2025-06-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['end_date']);
    });

    it('validates poster must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'   => 'Poster Tour',
            'poster' => 'not-a-url',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['poster']);
    });

    it('creates a tour with images', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'   => 'Image Tour',
            'images' => [
                ['url' => 'https://example.com/photo.jpg', 'caption' => 'Stage shot', 'sort_order' => 0],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.images.0.url', 'https://example.com/photo.jpg');
    });

    it('creates a tour with links', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'  => 'Link Tour',
            'links' => [
                ['label' => 'Buy Tickets', 'url' => 'https://example.com/buy'],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.links.0.label', 'Buy Tickets');
    });

    it('creates a tour with associated concerts', function () {
        $this->actingAsAdmin();
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2025-09-15']);

        $this->postJson('/api/tours', [
            'name'        => 'Concerts Tour',
            'concert_ids' => [$concert->id],
        ])->assertCreated();

        $tour = Tour::where('name', 'Concerts Tour')->firstOrFail();
        $this->assertDatabaseHas('concert_tour', ['tour_id' => $tour->id, 'concert_id' => $concert->id]);
    });
});

// ── PUT /api/tours/{tour} ─────────────────────────────────────────────────────

describe('PUT /api/tours/{tour}', function () {
    it('returns 401 without authentication', function () {
        $tour = Tour::create(['name' => 'T']);

        $this->putJson("/api/tours/{$tour->id}", ['name' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tour = Tour::create(['name' => 'T']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/tours/{$tour->id}", ['name' => 'X'])->assertForbidden();
    });

    it('updates a tour', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'Old Tour']);

        $this->putJson("/api/tours/{$tour->id}", ['name' => 'Updated Tour', 'description' => 'New description'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Updated Tour');
    });

    it('returns 404 for a non-existent tour', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/tours/9999', ['name' => 'X'])->assertNotFound();
    });

    it('validates name is required on update', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'T']);

        $this->putJson("/api/tours/{$tour->id}", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name max length of 255 characters on update', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'T']);

        $this->putJson("/api/tours/{$tour->id}", ['name' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates end_date must be after or equal to start_date on update', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'T']);

        $this->putJson("/api/tours/{$tour->id}", [
            'name'       => 'Bad Dates',
            'start_date' => '2025-07-01',
            'end_date'   => '2025-06-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['end_date']);
    });

    it('replaces images on update', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'T']);
        $tour->images()->create(['url' => 'https://example.com/old.jpg', 'sort_order' => 0]);

        $this->putJson("/api/tours/{$tour->id}", [
            'name'   => 'T',
            'images' => [
                ['url' => 'https://example.com/new.jpg', 'sort_order' => 0],
            ],
        ])->assertSuccessful()
          ->assertJsonPath('data.images.0.url', 'https://example.com/new.jpg');

        $this->assertDatabaseMissing('tour_images', ['url' => 'https://example.com/old.jpg']);
        $this->assertDatabaseHas('tour_images', ['url' => 'https://example.com/new.jpg']);
    });

    it('replaces links on update', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'T']);
        $tour->links()->create(['label' => 'Old Link', 'url' => 'https://example.com/old']);

        $this->putJson("/api/tours/{$tour->id}", [
            'name'  => 'T',
            'links' => [
                ['label' => 'New Link', 'url' => 'https://example.com/new'],
            ],
        ])->assertSuccessful()
          ->assertJsonPath('data.links.0.label', 'New Link');

        $this->assertDatabaseMissing('tour_links', ['label' => 'Old Link']);
        $this->assertDatabaseHas('tour_links', ['label' => 'New Link']);
    });

    it('syncs concerts on update', function () {
        $this->actingAsAdmin();
        $venue   = Venue::factory()->create();
        $old     = Concert::create(['venue_id' => $venue->id, 'date' => '2025-01-01']);
        $new     = Concert::create(['venue_id' => $venue->id, 'date' => '2025-02-01']);
        $tour    = Tour::create(['name' => 'T']);
        $tour->concerts()->attach($old);

        $this->putJson("/api/tours/{$tour->id}", [
            'name'        => 'T',
            'concert_ids' => [$new->id],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('concert_tour', ['tour_id' => $tour->id, 'concert_id' => $old->id]);
        $this->assertDatabaseHas('concert_tour', ['tour_id' => $tour->id, 'concert_id' => $new->id]);
    });
});

// ── DELETE /api/tours/{tour} ──────────────────────────────────────────────────

describe('DELETE /api/tours/{tour}', function () {
    it('returns 401 without authentication', function () {
        $tour = Tour::create(['name' => 'T']);

        $this->deleteJson("/api/tours/{$tour->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $tour = Tour::create(['name' => 'T']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/tours/{$tour->id}")->assertForbidden();
    });

    it('deletes a tour', function () {
        $this->actingAsAdmin();
        $tour = Tour::create(['name' => 'Gone Tour']);

        $this->deleteJson("/api/tours/{$tour->id}")->assertNoContent();

        $this->assertDatabaseMissing('tours', ['id' => $tour->id]);
    });

    it('returns 404 for a non-existent tour', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/tours/9999')->assertNotFound();
    });
});
