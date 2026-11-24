<?php

use App\Models\FanAccount;
use App\Models\FanIdentity;
use App\Support\FanSession;
use Illuminate\Database\UniqueConstraintViolationException;

function configureProviders(array $values): void
{
    foreach (['google', 'facebook'] as $p) {
        config([
            "services.$p.client_id"     => $values["$p-id"] ?? null,
            "services.$p.client_secret" => $values["$p-secret"] ?? null,
        ]);
    }
}

it('lists no provider when nothing is configured', function () {
    configureProviders([]);

    $this->getJson('/api/fan/auth/providers')->assertOk()->assertExactJson(['providers' => []]);
});

it('does not list a provider that has an id but no secret', function () {
    configureProviders(['google-id' => 'abc']);

    $this->getJson('/api/fan/auth/providers')->assertOk()->assertExactJson(['providers' => []]);
});

it('treats whitespace-only values as empty', function () {
    configureProviders(['google-id' => '  ', 'google-secret' => 'x']);

    $this->getJson('/api/fan/auth/providers')->assertExactJson(['providers' => []]);
});

it('lists a provider with both id and secret, and never the id', function () {
    configureProviders(['google-id' => 'abc', 'google-secret' => 'def']);

    $res = $this->getJson('/api/fan/auth/providers')->assertOk()->assertExactJson(['providers' => ['google']]);
    expect($res->getContent())->not->toContain('abc')->not->toContain('def');
});

it('lists both providers in config order', function () {
    configureProviders([
        'facebook-id' => 'f', 'facebook-secret' => 'g',
        'google-id'   => 'a', 'google-secret'   => 'b',
    ]);

    $this->getJson('/api/fan/auth/providers')->assertExactJson(['providers' => ['google', 'facebook']]);
});

it('says which provider vouches for the email', function () {
    expect(\App\Support\FanProviders::trustsEmail('google'))->toBeTrue()
        ->and(\App\Support\FanProviders::trustsEmail('facebook'))->toBeFalse()
        ->and(\App\Support\FanProviders::isEnabled('nope'))->toBeFalse();
});

it('lists the fan\'s linked providers on /fan/me', function () {
    $fan = FanAccount::factory()->create();
    FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '1']);
    FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'facebook', 'provider_user_id' => '2']);
    $token = FanSession::open($fan, 'link');

    $this->withToken($token)->getJson('/api/fan/me')->assertOk()
        ->assertJsonPath('providers', ['facebook', 'google']);
});

it('deletes identities with their fan', function () {
    $fan = FanAccount::factory()->create();
    FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '1']);

    $fan->delete();

    expect(FanIdentity::count())->toBe(0);
});

it('refuses the same provider identity twice', function () {
    $a = FanAccount::factory()->create();
    $b = FanAccount::factory()->create();
    FanIdentity::create(['fan_account_id' => $a->id, 'provider' => 'google', 'provider_user_id' => '1']);

    expect(fn () => FanIdentity::create(['fan_account_id' => $b->id, 'provider' => 'google', 'provider_user_id' => '1']))
        ->toThrow(UniqueConstraintViolationException::class);
});
