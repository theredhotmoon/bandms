<?php

use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use App\Models\User;
use App\Models\WebsiteModule;
use App\Support\WelcomeSettings;
use Laravel\Passport\Passport;

const WELCOME_DEFAULTS = [
    'blocks' => ['concerts', 'news', 'newsletter', 'account'],
    'concert_count' => 2,
    'frequency' => 'interval',
    'reshow_days' => 90,
    'campaign' => 0,
    'geo' => ['enabled' => false, 'radius_km' => 100, 'far_visitors' => 'hide_gigs'],
];

function welcomePayload(array $over = []): array
{
    $p = WELCOME_DEFAULTS;
    unset($p['campaign']);

    // replace_recursive merges lists by index, so a `blocks` override is applied by hand.
    $blocks = $over['blocks'] ?? $p['blocks'];

    return ['blocks' => $blocks] + array_replace_recursive($p, array_diff_key($over, ['blocks' => 1]));
}

it('returns defaults when nothing is stored', function () {
    expect(WelcomeSettings::get())->toBe(WELCOME_DEFAULTS);
});

it('clamps and filters a stored row', function () {
    SiteSetting::set(WelcomeSettings::SETTING_KEY, json_encode([
        'concert_count' => 9, 'reshow_days' => 0,
        'blocks' => ['news', 'bogus', 'news'],
        'geo' => ['radius_km' => 5, 'far_visitors' => 'x'],
    ]));

    $s = WelcomeSettings::get();
    expect($s['concert_count'])->toBe(3)
        ->and($s['reshow_days'])->toBe(1)
        ->and($s['blocks'])->toBe(['news'])
        ->and($s['geo']['radius_km'])->toBe(10)
        ->and($s['geo']['far_visitors'])->toBe('hide_gigs');
});

it('requires an admin', function () {
    $this->getJson('/api/admin/welcome-settings')->assertUnauthorized();
    $this->putJson('/api/admin/welcome-settings', welcomePayload())->assertUnauthorized();
    $this->postJson('/api/admin/welcome-settings/campaign')->assertUnauthorized();

    Passport::actingAs(User::factory()->create(['role' => 'member']));
    $this->getJson('/api/admin/welcome-settings')->assertForbidden();
    $this->putJson('/api/admin/welcome-settings', welcomePayload())->assertForbidden();
    $this->postJson('/api/admin/welcome-settings/campaign')->assertForbidden();
});

it('validates the PUT', function (array $over) {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $this->putJson('/api/admin/welcome-settings', welcomePayload($over))->assertStatus(422);
})->with([
    'concert_count' => [['concert_count' => 4]],
    'frequency' => [['frequency' => 'weekly']],
    'blocks' => [['blocks' => ['bogus']]],
    'radius' => [['geo' => ['radius_km' => 2000]]],
]);

it('saves a valid PUT', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $this->putJson('/api/admin/welcome-settings', welcomePayload(['concert_count' => 3, 'blocks' => ['news']]))
        ->assertOk()
        ->assertJsonPath('data.concert_count', 3)
        ->assertJsonPath('data.geo_available', false);
    expect(WelcomeSettings::get()['blocks'])->toBe(['news']);
});

it('saves an empty block list', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $this->putJson('/api/admin/welcome-settings', welcomePayload(['blocks' => []]))->assertOk();
    expect(WelcomeSettings::get()['blocks'])->toBe([]);
});

it('never changes the campaign on PUT', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $stamp = WelcomeSettings::stampCampaign();

    $this->putJson('/api/admin/welcome-settings', welcomePayload() + ['campaign' => 1])->assertOk();

    expect(WelcomeSettings::get()['campaign'])->toBe($stamp);
});

it('stamps a new campaign', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/welcome-settings/campaign')->assertOk()
        ->assertJson(fn ($j) => $j->where('data.campaign', fn ($c) => $c >= now()->timestamp - 5 && $c <= now()->timestamp)->etc());
});

it('serves welcome in site-config beside module_config', function () {
    $res = $this->getJson('/api/site-config')->assertOk()->assertJsonPath('welcome.frequency', 'interval');

    expect($res->json('module_config.welcome'))->not->toHaveKey('blocks');
});

it('marks website-modules dirty on save and on campaign', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    SiteDirtyArea::query()->delete();
    $this->putJson('/api/admin/welcome-settings', welcomePayload())->assertOk();
    expect(SiteDirtyArea::where('area', 'website-modules')->exists())->toBeTrue();

    SiteDirtyArea::query()->delete();
    $this->postJson('/api/admin/welcome-settings/campaign')->assertOk();
    expect(SiteDirtyArea::where('area', 'website-modules')->exists())->toBeTrue();
});

it('creates the welcome row disabled', function () {
    expect(WebsiteModule::where('slug', 'welcome')->first()->enabled)->toBeFalse();
});

it('casts string and integer inputs the validator accepts', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $payload = welcomePayload();
    $payload['concert_count'] = '3';
    $payload['reshow_days'] = '30';
    $payload['geo']['enabled'] = 1;
    $payload['geo']['radius_km'] = '250';

    $this->putJson('/api/admin/welcome-settings', $payload)->assertOk();

    $s = WelcomeSettings::get();
    expect($s['concert_count'])->toBe(3)
        ->and($s['reshow_days'])->toBe(30)
        ->and($s['geo']['enabled'])->toBeTrue()
        ->and($s['geo']['radius_km'])->toBe(250);
});

it('reads geo.enabled "0" as false', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $payload = welcomePayload();
    $payload['geo']['enabled'] = '0';

    $this->putJson('/api/admin/welcome-settings', $payload)->assertOk();

    expect(WelcomeSettings::get()['geo']['enabled'])->toBeFalse();
});

it('e2e:set-welcome-campaign restores only the campaign', function () {
    WelcomeSettings::save(['concert_count' => 3] + WELCOME_DEFAULTS);
    WelcomeSettings::stampCampaign();

    $this->artisan('e2e:set-welcome-campaign', ['campaign' => 1234, '--force' => true])->assertSuccessful();

    $s = WelcomeSettings::get();
    expect($s['campaign'])->toBe(1234)
        ->and($s['concert_count'])->toBe(3);
});

it('e2e:set-welcome-campaign rejects a non-numeric campaign', function () {
    $this->artisan('e2e:set-welcome-campaign', ['campaign' => 'abc', '--force' => true])->assertFailed();
    expect(WelcomeSettings::get()['campaign'])->toBe(0);
});

it('e2e:set-welcome-campaign refuses in production without --force, like e2e:seed-fan-session', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->artisan('e2e:set-welcome-campaign', ['campaign' => 99])
        ->expectsConfirmation('Are you sure you want to run this command?', 'no')
        ->assertFailed();
    $this->artisan('e2e:seed-fan-session')
        ->expectsConfirmation('Are you sure you want to run this command?', 'no')
        ->assertFailed();

    expect(WelcomeSettings::get()['campaign'])->toBe(0);
});
