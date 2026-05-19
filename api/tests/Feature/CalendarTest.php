<?php

use App\Models\BandMember;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/band-profile/calendar/events ─────────────────────────────────────

describe('GET /api/band-profile/calendar/events', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->getJson('/api/band-profile/calendar/events?start=2025-01-01&end=2025-02-01')
            ->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/band-profile/calendar/events?start=2025-01-01&end=2025-02-01')
            ->assertForbidden();
    });

    it('validates start is required', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/band-profile/calendar/events?end=2025-02-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start']);
    });

    it('validates end is required', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/band-profile/calendar/events?start=2025-01-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end']);
    });

    it('validates end must be after start', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/band-profile/calendar/events?start=2025-02-01&end=2025-01-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end']);
    });

    it('returns empty data array when no members have calendar_url', function () {
        $this->actingAsAdmin();
        BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'is_current' => true, 'can_login' => false]);

        $this->getJson('/api/band-profile/calendar/events?start=2025-01-01&end=2025-02-01')
            ->assertSuccessful()
            ->assertJsonPath('data', []);
    });
});

// ── GET /api/band-profile/calendar/availability ───────────────────────────────

describe('GET /api/band-profile/calendar/availability', function () {
    beforeEach(fn () => $this->createProfile());

    it('is publicly accessible', function () {
        $this->getJson('/api/band-profile/calendar/availability?date=2025-06-01')
            ->assertSuccessful();
    });

    it('validates date is required', function () {
        $this->getJson('/api/band-profile/calendar/availability')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    });

    it('returns availability structure with no members', function () {
        $this->getJson('/api/band-profile/calendar/availability?date=2025-06-15')
            ->assertSuccessful()
            ->assertJsonStructure(['data' => ['date', 'available', 'total_members', 'busy_count', 'busy_members']])
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.total_members', 0);
    });
});
