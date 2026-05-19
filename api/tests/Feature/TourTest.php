<?php

use App\Models\Tour;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/tours ────────────────────────────────────────────────────────────

describe('GET /api/tours', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/tours')->assertSuccessful();
    });

    it('returns tours ordered by start_date desc', function () {
        Tour::create(['name' => 'Old Tour', 'start_date' => '2020-01-01', 'end_date' => '2020-02-01']);
        Tour::create(['name' => 'New Tour', 'start_date' => '2025-01-01', 'end_date' => '2025-02-01']);

        $this->getJson('/api/tours')
            ->assertSuccessful()
            ->assertJsonPath('data.0.name', 'New Tour');
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

    it('validates end_date must be after or equal to start_date', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tours', [
            'name'       => 'Bad Dates',
            'start_date' => '2025-07-01',
            'end_date'   => '2025-06-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['end_date']);
    });
});

// ── PUT /api/tours/{tour} ─────────────────────────────────────────────────────

describe('PUT /api/tours/{tour}', function () {
    it('returns 401 without authentication', function () {
        $tour = Tour::create(['name' => 'T']);

        $this->putJson("/api/tours/{$tour->id}", ['name' => 'X'])->assertUnauthorized();
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
