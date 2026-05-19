<?php

use App\Models\User;
use App\Models\Venue;
use Laravel\Passport\Passport;

// ── GET /api/venues ───────────────────────────────────────────────────────────

describe('GET /api/venues', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/venues')->assertUnauthorized();
    });

    it('returns venues ordered by name', function () {
        $this->actingAsAdmin();
        Venue::factory()->create(['name' => 'Zebra Club']);
        Venue::factory()->create(['name' => 'Alpha Hall']);

        $this->getJson('/api/venues')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Hall');
    });

    it('returns empty collection when no venues exist', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/venues')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

// ── GET /api/venues/{venue} ───────────────────────────────────────────────────

describe('GET /api/venues/{venue}', function () {
    it('returns the venue', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'My Stage']);

        $this->getJson("/api/venues/{$venue->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'My Stage');
    });

    it('returns 404 for a non-existent venue', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/venues/9999')->assertNotFound();
    });
});

// ── POST /api/venues ──────────────────────────────────────────────────────────

describe('POST /api/venues', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/venues', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/venues', ['name' => 'Test'])->assertForbidden();
    });

    it('creates a venue with required fields only', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/venues', ['name' => 'Rock Arena'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Rock Arena')
            ->assertJsonPath('data.latitude', null);

        $this->assertDatabaseHas('venues', ['name' => 'Rock Arena']);
    });

    it('creates a venue with all optional fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/venues', [
            'name'          => 'Full Venue',
            'street'        => 'Main St',
            'street_number' => '42',
            'city'          => 'Warsaw',
            'postcode'      => '00-001',
            'latitude'      => 52.23,
            'longitude'     => 21.01,
        ])->assertCreated()
          ->assertJsonPath('data.city', 'Warsaw')
          ->assertJsonPath('data.latitude', 52.23);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/venues', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name must be unique', function () {
        $this->actingAsAdmin();
        Venue::factory()->create(['name' => 'Taken']);

        $this->postJson('/api/venues', ['name' => 'Taken'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates latitude range', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/venues', ['name' => 'Bad Lat', 'latitude' => 91.0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude']);
    });

    it('validates longitude range', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/venues', ['name' => 'Bad Lng', 'longitude' => 181.0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['longitude']);
    });
});

// ── PUT /api/venues/{venue} ───────────────────────────────────────────────────

describe('PUT /api/venues/{venue}', function () {
    it('returns 401 without authentication', function () {
        $venue = Venue::factory()->create();

        $this->putJson("/api/venues/{$venue->id}", ['name' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $venue = Venue::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/venues/{$venue->id}", ['name' => 'X'])->assertForbidden();
    });

    it('updates a venue', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'Old Name']);

        $this->putJson("/api/venues/{$venue->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('venues', ['id' => $venue->id, 'name' => 'New Name']);
    });

    it('clears coordinates when null is sent', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['latitude' => 50.0, 'longitude' => 20.0]);

        $this->putJson("/api/venues/{$venue->id}", ['latitude' => null, 'longitude' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.latitude', null);
    });

    it('returns 404 for a non-existent venue', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/venues/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/venues/{venue} ────────────────────────────────────────────────

describe('DELETE /api/venues/{venue}', function () {
    it('returns 401 without authentication', function () {
        $venue = Venue::factory()->create();

        $this->deleteJson("/api/venues/{$venue->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $venue = Venue::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/venues/{$venue->id}")->assertForbidden();
    });

    it('deletes a venue', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->deleteJson("/api/venues/{$venue->id}")->assertNoContent();

        $this->assertDatabaseMissing('venues', ['id' => $venue->id]);
    });

    it('returns 404 for a non-existent venue', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/venues/9999')->assertNotFound();
    });
});
