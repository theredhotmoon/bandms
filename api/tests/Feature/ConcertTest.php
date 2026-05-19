<?php

use App\Models\Band;
use App\Models\Concert;
use App\Models\User;
use App\Models\Venue;
use Laravel\Passport\Passport;

// ── GET /api/concerts ─────────────────────────────────────────────────────────

describe('GET /api/concerts', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/concerts')->assertSuccessful();
    });

    it('returns concerts with venue and bands', function () {
        $venue   = Venue::factory()->create(['name' => 'The Stage']);
        $band    = Band::create(['name' => 'Support Act']);
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-08-15']);
        $concert->bands()->attach($band, ['sort_order' => 1]);

        $this->getJson('/api/concerts')
            ->assertSuccessful()
            ->assertJsonPath('data.0.venue.name', 'The Stage')
            ->assertJsonPath('data.0.bands.0.name', 'Support Act');
    });

    it('returns concerts sorted by date then start_time', function () {
        $venue = Venue::factory()->create();
        Concert::create(['venue_id' => $venue->id, 'date' => '2026-10-01', 'start_time' => '20:00']);
        Concert::create(['venue_id' => $venue->id, 'date' => '2026-08-01']);
        Concert::create(['venue_id' => $venue->id, 'date' => '2026-10-01', 'start_time' => '18:00']);

        $data = $this->getJson('/api/concerts')->assertSuccessful()->json('data');

        expect($data[0]['date'])->toBe('2026-08-01');
    });
});

// ── GET /api/concerts/{concert} ───────────────────────────────────────────────

describe('GET /api/concerts/{concert}', function () {
    it('returns the concert with relations', function () {
        $venue   = Venue::factory()->create(['name' => 'Jazz Lounge']);
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        $this->getJson("/api/concerts/{$concert->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.venue.name', 'Jazz Lounge');
    });

    it('returns 404 for a non-existent concert', function () {
        $this->getJson('/api/concerts/9999')->assertNotFound();
    });
});

// ── POST /api/concerts ────────────────────────────────────────────────────────

describe('POST /api/concerts', function () {
    it('returns 401 without authentication', function () {
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-09-01'])
            ->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $venue = Venue::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-09-01'])
            ->assertForbidden();
    });

    it('creates a concert with required fields', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-09-20'])
            ->assertCreated()
            ->assertJsonPath('data.date', '2026-09-20');

        $this->assertDatabaseHas('concerts', ['venue_id' => $venue->id, 'date' => '2026-09-20']);
    });

    it('creates a concert with bands', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();
        $band  = Band::create(['name' => 'Headliner']);

        $this->postJson('/api/concerts', [
            'venue_id' => $venue->id,
            'date'     => '2026-09-20',
            'bands'    => [['id' => $band->id, 'sort_order' => 1]],
        ])->assertCreated()
          ->assertJsonPath('data.bands.0.name', 'Headliner');

        $this->assertDatabaseHas('concert_band', ['band_id' => $band->id]);
    });

    it('creates a concert with times', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', [
            'venue_id'   => $venue->id,
            'date'       => '2026-09-20',
            'doors_open' => '19:00',
            'start_time' => '20:00',
        ])->assertCreated()
          ->assertJsonPath('data.doors_open', '19:00')
          ->assertJsonPath('data.start_time', '20:00');
    });

    it('validates venue_id is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/concerts', ['date' => '2026-09-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['venue_id']);
    });

    it('validates venue must exist', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/concerts', ['venue_id' => 9999, 'date' => '2026-09-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['venue_id']);
    });

    it('validates date is required', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    });

    it('validates date format must be Y-m-d', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '20-06-2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    });

    it('validates start_time format must be H:i', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-06-01', 'start_time' => '8pm'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_time']);
    });
});

// ── PUT /api/concerts/{concert} ───────────────────────────────────────────────

describe('PUT /api/concerts/{concert}', function () {
    it('returns 401 without authentication', function () {
        $concert = Concert::factory()->create();

        $this->putJson("/api/concerts/{$concert->id}", ['date' => '2026-07-01'])->assertUnauthorized();
    });

    it('updates a concert', function () {
        $this->actingAsAdmin();
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-06-01']);

        $this->putJson("/api/concerts/{$concert->id}", [
            'venue_id'    => $venue->id,
            'date'        => '2026-07-04',
            'description' => 'Updated gig',
        ])->assertSuccessful()
          ->assertJsonPath('data.date', '2026-07-04')
          ->assertJsonPath('data.description', 'Updated gig');
    });

    it('replaces bands on update', function () {
        $this->actingAsAdmin();
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-06-01']);
        $old     = Band::create(['name' => 'Old Band']);
        $new     = Band::create(['name' => 'New Band']);
        $concert->bands()->attach($old, ['sort_order' => 1]);

        $this->putJson("/api/concerts/{$concert->id}", [
            'venue_id' => $venue->id,
            'date'     => '2026-06-01',
            'bands'    => [['id' => $new->id, 'sort_order' => 1]],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('concert_band', ['concert_id' => $concert->id, 'band_id' => $old->id]);
        $this->assertDatabaseHas('concert_band', ['concert_id' => $concert->id, 'band_id' => $new->id]);
    });

    it('returns 404 for a non-existent concert', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/concerts/9999', ['date' => '2026-07-01'])->assertNotFound();
    });
});

// ── DELETE /api/concerts/{concert} ────────────────────────────────────────────

describe('DELETE /api/concerts/{concert}', function () {
    it('returns 401 without authentication', function () {
        $concert = Concert::factory()->create();

        $this->deleteJson("/api/concerts/{$concert->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $concert = Concert::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/concerts/{$concert->id}")->assertForbidden();
    });

    it('deletes a concert', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();

        $this->deleteJson("/api/concerts/{$concert->id}")->assertNoContent();

        $this->assertDatabaseMissing('concerts', ['id' => $concert->id]);
    });

    it('returns 404 for a non-existent concert', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/concerts/9999')->assertNotFound();
    });
});
