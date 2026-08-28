<?php

use App\Models\Venue;
use Illuminate\Support\Facades\Http;

/**
 * The backfill's job is to turn addresses into pins without abusing a free
 * service. Both halves are tested: that it writes the right coordinates onto the
 * right rows, and that it does not make a request it could have avoided.
 *
 * `--force` appears on every call because the local backend container runs with
 * APP_ENV=production (see SeedE2eTicket for the same reason), so ConfirmableTrait
 * would otherwise block on a prompt no test can answer.
 */
function fakeNominatim(array $byQuery): void
{
    Http::fake(function ($request) use ($byQuery) {
        parse_str(parse_url($request->url(), PHP_URL_QUERY) ?: '', $params);
        $hit = $byQuery[$params['q'] ?? ''] ?? null;

        return Http::response($hit === null ? [] : [$hit]);
    });
}

it('writes coordinates onto a venue with an address', function () {
    $venue = Venue::create(['name' => 'Klub Studio', 'street' => 'Piastowska', 'street_number' => '47', 'city' => 'Kraków']);

    fakeNominatim(['Piastowska 47, Kraków' => ['lat' => '50.0682', 'lon' => '19.9060']]);

    $this->artisan('venues:geocode --force')->assertSuccessful();

    expect($venue->fresh()->latitude)->toBe(50.0682)
        ->and($venue->fresh()->longitude)->toBe(19.906);
});

it('leaves the database untouched on a dry run', function () {
    $venue = Venue::create(['name' => 'Klub Studio', 'city' => 'Kraków']);

    fakeNominatim(['Kraków' => ['lat' => '50.0614', 'lon' => '19.9366']]);

    $this->artisan('venues:geocode --dry-run')->assertSuccessful();

    expect($venue->fresh()->latitude)->toBeNull();
});

it('skips venues that already have coordinates', function () {
    Venue::create(['name' => 'Already pinned', 'city' => 'Kraków', 'latitude' => 1.0, 'longitude' => 2.0]);

    Http::fake();

    $this->artisan('venues:geocode --force')->assertSuccessful();

    Http::assertNothingSent();
});

it('re-geocodes an already-pinned venue when --all is given', function () {
    $venue = Venue::create(['name' => 'Moved', 'city' => 'Kraków', 'latitude' => 1.0, 'longitude' => 2.0]);

    fakeNominatim(['Kraków' => ['lat' => '50.0614', 'lon' => '19.9366']]);

    $this->artisan('venues:geocode --all --force')->assertSuccessful();

    expect($venue->fresh()->latitude)->toBe(50.0614);
});

it('skips a venue with no address rather than searching for its name', function () {
    Venue::create(['name' => 'Nameless field']);

    Http::fake();

    $this->artisan('venues:geocode --force')->assertSuccessful();

    // The name is deliberately not part of the query — a generic club name
    // resolves to a confident, wrong pin somewhere else entirely.
    Http::assertNothingSent();
});

it('makes one request per distinct address, not one per venue', function () {
    // This is the guard that keeps a 130-row backfill from becoming 130 requests
    // at one per second against a free service. Nine venues, one address.
    foreach (range(1, 9) as $i) {
        Venue::create(['name' => "Testville venue {$i}", 'city' => 'Testville']);
    }

    fakeNominatim(['Testville' => ['lat' => '10.0', 'lon' => '20.0']]);

    $this->artisan('venues:geocode --force')->assertSuccessful();

    Http::assertSentCount(1);
    expect(Venue::whereNotNull('latitude')->count())->toBe(9);
});

it('records no match when the geocoder finds nothing, and leaves the row alone', function () {
    $venue = Venue::create(['name' => 'Nowhere', 'city' => 'Definitely Not A Place']);

    fakeNominatim([]);

    $this->artisan('venues:geocode --force')->assertSuccessful();

    expect($venue->fresh()->latitude)->toBeNull();
});

it('treats a failed lookup as a miss instead of aborting the whole run', function () {
    $ok = Venue::create(['name' => 'Good', 'city' => 'Kraków']);
    $bad = Venue::create(['name' => 'Bad', 'city' => 'Broken']);

    Http::fake(function ($request) {
        parse_str(parse_url($request->url(), PHP_URL_QUERY) ?: '', $params);

        return ($params['q'] ?? '') === 'Broken'
            ? Http::response('upstream exploded', 500)
            : Http::response([['lat' => '50.0614', 'lon' => '19.9366']]);
    });

    $this->artisan('venues:geocode --force')->assertSuccessful();

    expect($ok->fresh()->latitude)->toBe(50.0614)
        ->and($bad->fresh()->latitude)->toBeNull();
});

it('stops after --limit venues', function () {
    foreach (range(1, 5) as $i) {
        Venue::create(['name' => "Venue {$i}", 'city' => "City {$i}"]);
    }

    fakeNominatim([
        'City 1' => ['lat' => '1.0', 'lon' => '1.0'],
        'City 2' => ['lat' => '2.0', 'lon' => '2.0'],
        'City 3' => ['lat' => '3.0', 'lon' => '3.0'],
    ]);

    $this->artisan('venues:geocode --limit=2 --force')->assertSuccessful();

    expect(Venue::whereNotNull('latitude')->count())->toBe(2);
});
