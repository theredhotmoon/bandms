<?php

use App\Models\Concert;
use App\Models\SiteSetting;
use App\Models\User;
use App\Models\WebsiteModule;
use App\Models\Venue;
use App\Support\Geo\Locator;
use App\Support\Geo\Point;
use App\Support\WelcomeSettings;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;
use Tests\Support\FakeLocator;

beforeEach(function () {
    SiteSetting::set(WelcomeSettings::SETTING_KEY, json_encode(['geo' => ['enabled' => true]]));
    WebsiteModule::where('slug', 'welcome')->update(['enabled' => true]);
});

function visitorAt(?Point $p, bool $available = true): void
{
    app()->instance(Locator::class, new FakeLocator($p, $available));
}

function gigAt(?float $lat, ?float $lng, string $date): Concert
{
    $venue = Venue::factory()->create(['latitude' => $lat, 'longitude' => $lng]);

    return Concert::factory()->create(['venue_id' => $venue->id, 'date' => $date]);
}

it('returns concerts within the radius', function () {
    visitorAt(new Point(50.0647, 19.9450));
    $krakow = gigAt(50.0614, 19.9372, now()->addDays(5)->toDateString());
    gigAt(54.352, 18.6466, now()->addDays(3)->toDateString());

    $this->getJson('/api/welcome/nearby')
        ->assertOk()
        ->assertExactJson(['located' => true, 'concert_ids' => [$krakow->id]]);
});

it('honours the radius setting and orders by date', function () {
    SiteSetting::set(WelcomeSettings::SETTING_KEY, json_encode(['geo' => ['enabled' => true, 'radius_km' => 1000]]));
    visitorAt(new Point(50.0647, 19.9450));
    $later = gigAt(50.0614, 19.9372, now()->addDays(9)->toDateString());
    $sooner = gigAt(54.352, 18.6466, now()->addDays(2)->toDateString());

    $this->getJson('/api/welcome/nearby')
        ->assertExactJson(['located' => true, 'concert_ids' => [$sooner->id, $later->id]]);
});

it('excludes past concerts and venues without coordinates', function () {
    visitorAt(new Point(50.0647, 19.9450));
    gigAt(50.0614, 19.9372, now()->subDay()->toDateString());
    gigAt(null, null, now()->addDays(4)->toDateString());
    $today = gigAt(50.0614, 19.9372, now()->toDateString());

    $this->getJson('/api/welcome/nearby')
        ->assertExactJson(['located' => true, 'concert_ids' => [$today->id]]);
});

it('reports located false when the locator cannot place the ip', function () {
    visitorAt(null);
    gigAt(50.0614, 19.9372, now()->addDays(4)->toDateString());

    $this->getJson('/api/welcome/nearby')
        ->assertOk()
        ->assertExactJson(['located' => false, 'concert_ids' => []]);
});

it('does not call the locator when geo targeting is off', function () {
    SiteSetting::set(WelcomeSettings::SETTING_KEY, json_encode(['geo' => ['enabled' => false]]));
    $locator = new class implements Locator {
        public int $calls = 0;
        public function locate(string $ip): ?Point { $this->calls++; return new Point(50.0647, 19.9450); }
        public function available(): bool { return true; }
    };
    app()->instance(Locator::class, $locator);
    gigAt(50.0614, 19.9372, now()->addDays(5)->toDateString());

    $this->getJson('/api/welcome/nearby')->assertExactJson(['located' => false, 'concert_ids' => []]);
    expect($locator->calls)->toBe(0);
});

it('does not call the locator when the welcome module is disabled', function () {
    WebsiteModule::where('slug', 'welcome')->update(['enabled' => false]);
    $locator = new class implements Locator {
        public int $calls = 0;
        public function locate(string $ip): ?Point { $this->calls++; return new Point(50.0647, 19.9450); }
        public function available(): bool { return true; }
    };
    app()->instance(Locator::class, $locator);

    $this->getJson('/api/welcome/nearby')->assertExactJson(['located' => false, 'concert_ids' => []]);
    expect($locator->calls)->toBe(0);
});

it('never echoes coordinates or the ip', function () {
    visitorAt(new Point(50.0647, 19.9450));

    $json = $this->getJson('/api/welcome/nearby')->json();

    expect(array_keys($json))->toBe(['located', 'concert_ids']);
});

it('reports geo_available from the locator', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    visitorAt(null, true);
    $this->getJson('/api/admin/welcome-settings')->assertJsonPath('data.geo_available', true);

    visitorAt(null, false);
    $this->getJson('/api/admin/welcome-settings')->assertJsonPath('data.geo_available', false);
});

it('geoip:update exits cleanly without a key', function () {
    config(['geoip.license_key' => '']);
    Http::fake();

    $this->artisan('geoip:update')->expectsOutputToContain('no licence key')->assertExitCode(0);

    Http::assertNothingSent();
});

it('geoip:update downloads and installs the database with the key in basic auth', function () {
    $dir = sys_get_temp_dir().'/geoip-test-'.uniqid();
    mkdir($dir.'/src/GeoLite2-City_20261117', 0777, true);
    file_put_contents($dir.'/src/GeoLite2-City_20261117/GeoLite2-City.mmdb', 'FAKE-MMDB');
    (new PharData($dir.'/db.tar'))->buildFromDirectory($dir.'/src');
    (new PharData($dir.'/db.tar'))->compress(Phar::GZ);
    $archive = file_get_contents($dir.'/db.tar.gz');

    $target = $dir.'/out/GeoLite2-City.mmdb';
    config(['geoip.license_key' => 'secret-key', 'geoip.account_id' => '12345', 'geoip.path' => $target]);
    Http::fake(['download.maxmind.com/*' => Http::response($archive, 200)]);

    $this->artisan('geoip:update')->assertExitCode(0);

    expect(file_get_contents($target))->toBe('FAKE-MMDB');
    Http::assertSent(fn ($r) => ! str_contains($r->url(), 'secret-key')
        && $r->hasHeader('Authorization', 'Basic '.base64_encode('12345:secret-key')));
});

it('geoip:update leaves the old database and fails when the download fails', function () {
    $dir = sys_get_temp_dir().'/geoip-test-'.uniqid();
    mkdir($dir);
    file_put_contents($dir.'/GeoLite2-City.mmdb', 'OLD');
    config(['geoip.license_key' => 'secret-key', 'geoip.account_id' => '12345', 'geoip.path' => $dir.'/GeoLite2-City.mmdb']);
    Http::fake(['download.maxmind.com/*' => Http::response('nope', 401)]);

    $this->artisan('geoip:update')->assertExitCode(1);

    expect(file_get_contents($dir.'/GeoLite2-City.mmdb'))->toBe('OLD');
});
