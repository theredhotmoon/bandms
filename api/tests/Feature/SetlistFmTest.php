<?php

use Illuminate\Support\Facades\Http;

// ── GET /api/setlists/setlistfm/search ────────────────────────────────────────

describe('GET /api/setlists/setlistfm/search', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/setlists/setlistfm/search?q=Metallica')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->getJson('/api/setlists/setlistfm/search?q=Metallica')->assertForbidden();
    });

    it('validates q is required', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/setlists/setlistfm/search')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['q']);
    });

    it('validates q max length is 100', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/setlists/setlistfm/search?q=' . str_repeat('x', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['q']);
    });

    it('returns 503 when the setlist.fm API key is not configured', function () {
        config(['services.setlistfm.api_key' => '']);
        $this->actingAsAdmin();

        $this->getJson('/api/setlists/setlistfm/search?q=Metallica')
            ->assertStatus(503)
            ->assertJsonPath('error', 'setlist.fm API key not configured');
    });

    it('returns mapped artist list from setlist.fm', function () {
        config(['services.setlistfm.api_key' => 'test-key']);
        $this->actingAsAdmin();

        Http::fake([
            'api.setlist.fm/*' => Http::response([
                'artist' => [
                    ['mbid' => 'abc-123', 'name' => 'Metallica'],
                    ['mbid' => 'def-456', 'name' => 'Metallica Tribute'],
                ],
            ], 200),
        ]);

        $this->getJson('/api/setlists/setlistfm/search?q=Metallica')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.mbid', 'abc-123')
            ->assertJsonPath('data.0.name', 'Metallica');
    });

    it('returns 502 when the setlist.fm API returns an error', function () {
        config(['services.setlistfm.api_key' => 'test-key']);
        $this->actingAsAdmin();

        Http::fake(['api.setlist.fm/*' => Http::response([], 500)]);

        $this->getJson('/api/setlists/setlistfm/search?q=Metallica')
            ->assertStatus(502)
            ->assertJsonPath('error', 'setlist.fm API error');
    });
});

// ── GET /api/setlists/setlistfm/{mbid}/setlists ───────────────────────────────

describe('GET /api/setlists/setlistfm/{mbid}/setlists', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/setlists/setlistfm/abc-123/setlists')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->getJson('/api/setlists/setlistfm/abc-123/setlists')->assertForbidden();
    });

    it('returns 503 when the setlist.fm API key is not configured', function () {
        config(['services.setlistfm.api_key' => '']);
        $this->actingAsAdmin();

        $this->getJson('/api/setlists/setlistfm/abc-123/setlists')
            ->assertStatus(503);
    });

    it('returns mapped setlists with song counts', function () {
        config(['services.setlistfm.api_key' => 'test-key']);
        $this->actingAsAdmin();

        Http::fake([
            'api.setlist.fm/*' => Http::response([
                'total'   => 1,
                'setlist' => [
                    [
                        'id'        => 'setlist-001',
                        'eventDate' => '01-06-2024',
                        'venue'     => ['name' => 'Madison Square Garden', 'city' => ['name' => 'New York']],
                        'sets'      => [
                            'set' => [
                                ['song' => [['name' => 'Enter Sandman'], ['name' => 'Nothing Else Matters']]],
                                ['song' => [['name' => 'One']], 'encore' => 1],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->getJson('/api/setlists/setlistfm/abc-123/setlists')
            ->assertSuccessful()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('page', 1);

        $data = $response->json('data');
        expect($data)->toHaveCount(1);
        expect($data[0]['song_count'])->toBe(3);
        expect($data[0]['venue'])->toContain('Madison Square Garden');
    });

    it('filters out setlists with no songs', function () {
        config(['services.setlistfm.api_key' => 'test-key']);
        $this->actingAsAdmin();

        Http::fake([
            'api.setlist.fm/*' => Http::response([
                'total'   => 2,
                'setlist' => [
                    ['id' => 's1', 'eventDate' => '01-01-2024', 'venue' => ['name' => 'Club'], 'sets' => ['set' => []]],
                    ['id' => 's2', 'eventDate' => '02-01-2024', 'venue' => ['name' => 'Arena'], 'sets' => ['set' => [['song' => [['name' => 'Song A']]]]]],
                ],
            ], 200),
        ]);

        $data = $this->getJson('/api/setlists/setlistfm/abc-123/setlists')
            ->assertSuccessful()
            ->json('data');

        expect($data)->toHaveCount(1);
    });

    it('returns 502 when the setlist.fm API returns an error', function () {
        config(['services.setlistfm.api_key' => 'test-key']);
        $this->actingAsAdmin();

        Http::fake(['api.setlist.fm/*' => Http::response([], 404)]);

        $this->getJson('/api/setlists/setlistfm/abc-123/setlists')
            ->assertStatus(502);
    });
});
