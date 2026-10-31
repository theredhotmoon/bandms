<?php

use App\Models\AssistantRun;
use App\Models\User;
use App\Support\ContactCodes;
use App\Support\CrawlerSettings;
use Laravel\Passport\Passport;

// The crawler's settings: one JSON row in site_settings, normalised on read so
// a missing or stale key never breaks a run. Spend is controlled here, so only
// a superadmin may read or change them.

function crawlerSuperadmin(): User
{
    $u = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
    Passport::actingAs($u);

    return $u;
}

it('defaults to the ska-map country list, each one in the countries table and in ContactCodes', function () {
    $countries = CrawlerSettings::get()['countries'];

    expect($countries)->toBe(['PL', 'DE', 'CZ', 'SK', 'LT', 'GB', 'NL', 'ES', 'IT', 'US', 'MX', 'JP', 'BR']);
    foreach ($countries as $c) {
        expect(config("countries.{$c}"))->toHaveKeys(['name', 'native', 'gl', 'hl'])
            ->and(ContactCodes::COUNTRIES)->toContain($c);
    }
    expect(config('countries.GB.gl'))->toBe('uk');
});

it('normalises a stored value: unknown countries dropped, caps bounded, sources completed', function () {
    \App\Models\SiteSetting::set(CrawlerSettings::SETTING_KEY, json_encode([
        'countries' => ['DE', 'XX', 'de'],
        'sources'   => ['google_cse' => ['enabled' => true, 'cap_day' => 5000]],
    ]));

    $s = CrawlerSettings::get();

    expect($s['countries'])->toBe(['DE'])
        ->and($s['sources']['google_cse']['cap_day'])->toBe(100)
        ->and($s['sources'])->toHaveKeys(['google_cse', 'youtube', 'setlistfm', 'places', 'meta_own', 'reddit', 'rss']);
});

it('defaults reddit off, every other source on', function () {
    $sources = CrawlerSettings::get()['sources'];

    expect($sources['reddit']['enabled'])->toBeFalse()
        ->and($sources['google_cse']['enabled'])->toBeTrue()
        ->and($sources['places']['cap_month'])->toBe(900);
});

it('knows which sources lack their key', function () {
    config(['services.google.api_key' => '', 'services.google.cse_id' => 'x', 'services.youtube.api_key' => 'k']);

    expect(CrawlerSettings::keyMissing('google_cse'))->toBeTrue()
        ->and(CrawlerSettings::keyMissing('youtube'))->toBeFalse()
        ->and(CrawlerSettings::keyMissing('rss'))->toBeFalse();
});

it('lets a superadmin read the settings with each source\'s key state and last run', function () {
    crawlerSuperadmin();
    config(['services.youtube.api_key' => 'k']);
    AssistantRun::create(['source' => 'youtube', 'started_at' => now(), 'status' => 'capped', 'queries' => 20]);

    $res = $this->getJson('/api/admin/assistant/settings')->assertOk();

    $youtube = collect($res->json('sources'))->firstWhere('key', 'youtube');
    expect($res->json('data.countries'))->toContain('PL')
        ->and($youtube['hasKey'])->toBeTrue()
        ->and($youtube['lastRun']['status'])->toBe('capped');
});

it('saves valid settings and refuses invalid ones', function () {
    crawlerSuperadmin();

    $this->putJson('/api/admin/assistant/settings', [
        'keywords'  => ['Skanking Storks', 'Storks ska'],
        'countries' => ['PL', 'JP'],
        'rss_feeds' => ['https://ska.example/feed.xml'],
        'digest_to' => ['band@example.com'],
    ])->assertOk()->assertJsonPath('data.countries', ['PL', 'JP']);

    $this->putJson('/api/admin/assistant/settings', ['countries' => ['XX']])->assertStatus(422);
    $this->putJson('/api/admin/assistant/settings', ['rss_feeds' => ['not a url']])->assertStatus(422);
    $this->putJson('/api/admin/assistant/settings', ['digest_to' => ['nope']])->assertStatus(422);
});

it('keeps the settings to superadmins', function () {
    $this->actingAsAdmin();
    $this->getJson('/api/admin/assistant/settings')->assertForbidden();
    $this->putJson('/api/admin/assistant/settings', ['countries' => ['PL']])->assertForbidden();
});

it('says which sources are not built yet', function () {
    crawlerSuperadmin();

    $sources = collect($this->getJson('/api/admin/assistant/settings')->assertOk()->json('sources'))->keyBy('key');

    expect($sources['google_cse']['available'])->toBeTrue()
        ->and($sources['youtube']['available'])->toBeTrue()
        ->and($sources['rss']['available'])->toBeFalse();
});
