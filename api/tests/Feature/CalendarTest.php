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
            ->assertJsonStructure(['data' => ['date', 'available', 'total_members', 'busy_count']])
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.total_members', 0);
    });

    // This endpoint needs no auth. It used to return busy_members with each
    // member's full name and role, so anyone could enumerate which musician was
    // unavailable on which day. The aggregate is all a promoter ever needed.
    it('never exposes which member is busy', function () {
        $this->getJson('/api/band-profile/calendar/availability?date=2025-06-15')
            ->assertSuccessful()
            ->assertJsonMissingPath('data.busy_members');
    });
});

// ── GET /api/band-profile/calendar/availability-range ─────────────────────────

describe('GET /api/band-profile/calendar/availability-range', function () {
    beforeEach(fn () => $this->createProfile());

    it('is publicly accessible', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-30')
            ->assertSuccessful();
    });

    it('validates start and end', function () {
        $this->getJson('/api/band-profile/calendar/availability-range')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start', 'end']);
    });

    it('rejects an end before the start', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-30&end=2025-06-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end']);
    });

    // Every extra day is remote iCal parsing, so an unbounded range is a way to
    // hang the request rather than a feature.
    it('caps the range at 92 days', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-01-01&end=2025-12-31')
            ->assertUnprocessable();
    });

    it('returns one entry per day, inclusive of both ends', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-30')
            ->assertSuccessful()
            ->assertJsonCount(30, 'data')
            ->assertJsonPath('data.0.date', '2025-06-01')
            ->assertJsonPath('data.29.date', '2025-06-30');
    });

    it('reports days as open when nothing is booked', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-03')
            ->assertJsonPath('data.0.status', 'open');
    });

    // Same privacy contract as the single-date endpoint: coarse status only.
    it('exposes only a status per day, never member identities', function () {
        $response = $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-03')
            ->assertSuccessful();

        foreach ($response->json('data') as $day) {
            expect(array_keys($day))->toBe(['date', 'status'])
                ->and($day['status'])->toBeIn(['open', 'held', 'booked']);
        }
    });
});

// ── availability-range window and multi-day coverage (fixed 2026-08-27) ──────

describe('availability-range day coverage', function () {
    beforeEach(fn () => $this->createProfile());

    // The expand window ran to midnight *at the start* of the last day, so
    // nothing happening on it was ever seen and it always reported `open`.
    it('includes the final day of the range', function () {
        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-30')
            ->assertSuccessful()
            ->assertJsonPath('data.29.date', '2025-06-30')
            ->assertJsonPath('data.29.status', 'open');
    });

    it('marks a concert on the final day as booked', function () {
        $venue = \App\Models\Venue::factory()->create();
        \App\Models\Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2025-06-30']);

        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-30')
            ->assertSuccessful()
            ->assertJsonPath('data.29.status', 'booked');
    });

    it('marks a concert on the first day as booked', function () {
        $venue = \App\Models\Venue::factory()->create();
        \App\Models\Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2025-06-01']);

        $this->getJson('/api/band-profile/calendar/availability-range?start=2025-06-01&end=2025-06-30')
            ->assertSuccessful()
            ->assertJsonPath('data.0.status', 'booked');
    });

    it('is rate limited', function () {
        // Unauthenticated and expensive: each uncached call expands up to 92 days
        // of iCal per member, and the cache key is the exact range.
        $route = collect(app('router')->getRoutes())
            ->first(fn ($r) => $r->getName() === 'api.calendar.availability-range');

        expect($route->gatherMiddleware())->toContain('throttle:30,1');
    });
});
