<?php

use App\Mail\FanPasswordChanged;
use App\Models\FanAccount;
use App\Models\FanSessionRow;
use App\Support\FanMagicToken;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

function fanRegisterClaim(): array
{
    $c = Str::random(64);

    return [$c, hash('sha256', $c)];
}

/** Register and return the token out of the dev link (debug on, so it is served). */
function fanRegisterTokenFor(array $body, int $status = 200): string
{
    config(['app.debug' => true]);
    $res = test()->postJson('/api/fan/auth/register', $body)->assertStatus($status);
    parse_str((string) parse_url($res->json('dev_link'), PHP_URL_QUERY), $q);

    return $q['token'];
}

function fanRegisterMessages(): array
{
    return app('mailer')->getSymfonyTransport()->messages()->all();
}

beforeEach(function () {
    RateLimiter::clear('fan-register' . sha1('|127.0.0.1'));
});

it('activates the password when the link is opened with the claim', function () {
    [$claim, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertOk();

    expect($res->json('password_set'))->toBeTrue();
    expect($res->json('linked'))->toBeNull();
    $fan = FanAccount::where('email', 'new@example.com')->sole();
    expect(Hash::check('correct horse', $fan->password_hash))->toBeTrue();
    expect($fan->email_verified_at)->not->toBeNull();
    expect(FanSessionRow::sole()->method)->toBe('link');
});

it('signs in but sets no password without the claim', function () {
    [, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token)->assertOk();

    expect($res->json('password_set'))->toBeFalse();
    expect(FanAccount::where('email', 'new@example.com')->sole()->password_hash)->toBeNull();
});

it('signs in but sets no password with a wrong claim', function () {
    [, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . Str::random(64))->assertOk();

    expect($res->json('password_set'))->toBeFalse();
    expect(FanAccount::where('email', 'new@example.com')->sole()->password_hash)->toBeNull();
});

it('treats a claim that is not a string as no claim, never a 500', function () {
    [, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim[]=x')->assertOk();

    expect($res->json('password_set'))->toBeFalse();
});

it('sets no password when register sent no claim_hash at all', function () {
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse']);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . Str::random(64))->assertOk();

    expect($res->json('password_set'))->toBeFalse();
    expect(FanAccount::where('email', 'new@example.com')->sole()->password_hash)->toBeNull();
});

it('never replaces an existing password', function () {
    FanAccount::factory()->create(['email' => 'has@example.com', 'password_hash' => Hash::make('the old one')]);
    [$claim, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'has@example.com', 'password' => 'attacker pass', 'claim_hash' => $hash]);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertOk();

    expect($res->json('password_set'))->toBeFalse();
    $fan = FanAccount::where('email', 'has@example.com')->sole();
    expect(Hash::check('the old one', $fan->password_hash))->toBeTrue();
    expect(Hash::check('attacker pass', $fan->password_hash))->toBeFalse();
});

it('never parks a password in the cache for an account that has one', function () {
    FanAccount::factory()->create(['email' => 'has@example.com', 'password_hash' => Hash::make('the old one')]);
    [, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'has@example.com', 'password' => 'attacker pass', 'claim_hash' => $hash]);

    $parked = Cache::get("fan_magic:{$token}");

    expect($parked)->toBeArray();
    expect($parked['password_hash'] ?? null)->toBeNull();
});

it('parks only a hash, never the plain password', function () {
    [, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    expect(json_encode(Cache::get("fan_magic:{$token}")))->not->toContain('correct horse');
});

it('answers identically for a new and an existing email', function () {
    config(['app.debug' => false]);
    FanAccount::factory()->create(['email' => 'known@example.com']);
    FanAccount::factory()->create(['email' => 'has@example.com', 'password_hash' => Hash::make('the old one')]);

    $a = $this->postJson('/api/fan/auth/register', ['email' => 'known@example.com', 'password' => 'correct horse']);
    $b = $this->postJson('/api/fan/auth/register', ['email' => 'unknown@example.com', 'password' => 'correct horse']);
    $c = $this->postJson('/api/fan/auth/register', ['email' => 'has@example.com', 'password' => 'correct horse']);

    expect($a->status())->toBe(200)->toBe($b->status())->toBe($c->status());
    expect($a->json())->toBe($b->json())->toBe($c->json());
    expect($a->json('message'))->toBe(__('api.fan.register_sent'));
    expect($a->json('token'))->toBeNull();
    expect(FanSessionRow::count())->toBe(0);
});

it('sends no password to the mail', function () {
    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => 'correct horse']);

    $messages = fanRegisterMessages();
    expect($messages)->toHaveCount(1);
    $body = $messages[0]->toString();
    expect($body)->toContain('/account?token=');
    expect($body)->not->toContain('correct horse');
});

it('exchanges a link issued before the deploy', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_magic:old', $fan->id, now()->addHour());

    $this->getJson('/api/fan/auth/verify?token=old')
        ->assertOk()
        ->assertJsonPath('password_set', false);
});

it('refuses the second opening of one link and leaves the first result intact', function () {
    [$claim, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash]);

    $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertOk();
    $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertStatus(401);

    $fan = FanAccount::where('email', 'new@example.com')->sole();
    expect(Hash::check('correct horse', $fan->password_hash))->toBeTrue();
    expect(FanSessionRow::count())->toBe(1);
});

it('rejects a weak password with a 422 before anything is mailed', function () {
    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => 'short'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('password');

    expect(fanRegisterMessages())->toBeEmpty();
    expect(FanAccount::where('email', 'new@example.com')->exists())->toBeFalse();
});

it('rejects a claim_hash that is not a sha-256 hex digest', function () {
    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => 'nope'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('claim_hash');
});

it('keeps the return path on a register link', function () {
    config(['app.debug' => true]);

    $res = $this->postJson('/api/fan/auth/register', [
        'email' => 'new@example.com', 'password' => 'correct horse', 'return_to' => '/en/news/x',
    ])->assertOk();

    expect($res->json('dev_link'))->toContain('&return=%2Fen%2Fnews%2Fx');
});

it('finds the account whatever case the email is typed in', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com']);

    $this->postJson('/api/fan/auth/register', ['email' => ' Fan@Example.COM ', 'password' => 'correct horse'])->assertOk();

    expect(FanAccount::count())->toBe(1);
});

it('answers 503, forgets the parked token and logs neither password nor address', function () {
    [, $hash] = fanRegisterClaim();
    Mail::shouldReceive('raw')->once()->andThrow(new RuntimeException('smtp to secret@example.com down'));
    Log::spy();

    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash])
        ->assertStatus(503);

    $fan = FanAccount::where('email', 'new@example.com')->sole();
    Log::shouldHaveReceived('warning')->once()->withArgs(function ($message) use ($fan) {
        return str_contains($message, (string) $fan->id)
            && ! str_contains($message, 'correct horse')
            && ! str_contains($message, 'secret@example.com')
            && ! str_contains($message, 'new@example.com');
    });
    // The token was random; the only fan_magic entry the request made must be gone.
    $storage = (new ReflectionProperty(Cache::getStore(), 'storage'))->getValue(Cache::getStore());
    expect(array_filter(array_keys($storage), fn ($k) => str_contains($k, 'fan_magic:')))->toBeEmpty();
});

it('opens the session with the method the token carries', function () {
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('the old one')]);
    $token = FanMagicToken::issue($fan, ['method' => 'google']);

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token)->assertOk();

    expect(FanSessionRow::sole()->method)->toBe('google');
    expect($res->json('fan.password_needs_current'))->toBeTrue();
});

it('does not overwrite a password set between registering and opening the link', function () {
    [$claim, $hash] = fanRegisterClaim();
    $token = fanRegisterTokenFor(['email' => 'new@example.com', 'password' => 'first choice', 'claim_hash' => $hash]);
    $fan = FanAccount::where('email', 'new@example.com')->sole();
    $fan->forceFill(['password_hash' => Hash::make('newer choice')])->save();

    $res = $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertOk();

    expect($res->json('password_set'))->toBeFalse();
    expect(Hash::check('newer choice', $fan->fresh()->password_hash))->toBeTrue();
});

it('mails the fan "password set" when the exchange applies a password, and only then', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => null]);
    [$claim, $hash] = fanRegisterClaim();

    $applied = FanMagicToken::issue($fan, ['password_hash' => Hash::make('correct horse'), 'claim_hash' => $hash]);
    $this->getJson('/api/fan/auth/verify?token=' . $applied . '&claim=' . $claim)->assertOk()->assertJsonPath('password_set', true);
    Mail::assertSent(FanPasswordChanged::class, fn ($m) => $m->hasTo($fan->email) && $m->isFirst === true);

    Mail::fake();
    $other  = FanAccount::factory()->create(['password_hash' => null]);
    $parked = FanMagicToken::issue($other, ['password_hash' => Hash::make('correct horse'), 'claim_hash' => $hash]);
    $this->getJson('/api/fan/auth/verify?token=' . $parked . '&claim=' . Str::random(64))->assertOk()->assertJsonPath('password_set', false);
    Mail::assertNothingSent();
});

it('does not fail the sign-in when the password-set mail fails', function () {
    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp to secret@example.com down'));
    Log::spy();
    $fan = FanAccount::factory()->create(['password_hash' => null]);
    [$claim, $hash] = fanRegisterClaim();
    $token = FanMagicToken::issue($fan, ['password_hash' => Hash::make('correct horse'), 'claim_hash' => $hash]);

    $this->getJson('/api/fan/auth/verify?token=' . $token . '&claim=' . $claim)->assertOk()->assertJsonPath('password_set', true);

    Log::shouldHaveReceived('warning')->withArgs(fn ($m) => ! str_contains($m, 'secret@example.com'));
});

it('has a limit of its own', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/fan/auth/register', ['email' => "u{$i}@example.com", 'password' => 'correct horse'])->assertOk();
    }

    $this->postJson('/api/fan/auth/register', ['email' => 'u6@example.com', 'password' => 'correct horse'])->assertStatus(429);
});
