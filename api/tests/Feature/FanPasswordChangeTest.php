<?php

use App\Mail\FanPasswordChanged;
use App\Models\FanAccount;
use App\Models\FanSessionRow;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

function putPassword(string $token, array $body)
{
    return test()->withToken($token)->putJson('/api/fan/me/password', $body);
}

/**
 * What another request does after this one was authenticated and before it holds the fan's row.
 * It runs inside this request's transaction, so a 401 undoes it too.
 */
function beforeFanLock(Closure $other): void
{
    $done = false;
    Event::listen(TransactionBeginning::class, function () use (&$done, $other) {
        if (! $done) {
            $done = true;
            $other();
        }
    });
}

it('sets a first password from any session', function () {
    Mail::fake();
    $fan = FanAccount::factory()->create(['password_hash' => null]);

    $res = putPassword(fanToken($fan, 'google'), ['password' => 'correct horse'])->assertOk();

    expect(Hash::check('correct horse', $fan->fresh()->password_hash))->toBeTrue();
    expect($res->json('has_password'))->toBeTrue();
    expect($res->json())->not->toHaveKey('password_hash');
    Mail::assertSent(FanPasswordChanged::class, fn ($m) => $m->hasTo($fan->email) && $m->isFirst === true);
});

it('needs the current password to change one', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');

    putPassword($token, ['password' => 'new password'])->assertStatus(422)->assertJsonValidationErrors('current_password');
    putPassword($token, ['password' => 'new password', 'current_password' => 'wrong one'])
        ->assertStatus(422)->assertJsonValidationErrors('current_password');
    expect(Hash::check('old password', $fan->fresh()->password_hash))->toBeTrue();

    putPassword($token, ['password' => 'new password', 'current_password' => 'old password'])->assertOk();
    expect(Hash::check('new password', $fan->fresh()->password_hash))->toBeTrue();
    Mail::assertSent(FanPasswordChanged::class, fn ($m) => $m->isFirst === false);
});

it('validates the new password', function () {
    $fan = FanAccount::factory()->create(['password_hash' => null]);

    putPassword(fanToken($fan), ['password' => 'short'])->assertStatus(422)->assertJsonValidationErrors('password');
});

it('changes without the current password from a link session under 15 minutes old', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'link');

    $this->withToken($token)->getJson('/api/fan/me')->assertOk()->assertJsonPath('password_needs_current', false);
    putPassword($token, ['password' => 'new password'])->assertOk();
    expect(Hash::check('new password', $fan->fresh()->password_hash))->toBeTrue();
});

it('asks for the current password from a link session 16 minutes old', function () {
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'link');

    $this->travel(16)->minutes();

    $this->withToken($token)->getJson('/api/fan/me')->assertOk()->assertJsonPath('password_needs_current', true);
    putPassword($token, ['password' => 'new password'])->assertStatus(422)->assertJsonValidationErrors('current_password');
});

it('does not treat a migrated legacy session as a fresh link', function () {
    $fan = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    Cache::put('fan_session:legacytoken', $fan->id, now()->addDays(30));

    putPassword('legacytoken', ['password' => 'new password'])
        ->assertStatus(422)->assertJsonValidationErrors('current_password');
    expect(Hash::check('old password', $fan->fresh()->password_hash))->toBeTrue();
});

it('signs out every other session and keeps this one', function () {
    Mail::fake();
    $fan = FanAccount::factory()->create(['password_hash' => null]);
    $a = fanToken($fan);
    $b = fanToken($fan, 'google');
    Cache::put('fan_session:legacyC', $fan->id, now()->addDays(30));

    putPassword($a, ['password' => 'new password'])->assertOk();

    $this->withToken($a)->getJson('/api/fan/me')->assertOk();
    $this->withToken($b)->getJson('/api/fan/me')->assertStatus(401);
    $this->withToken('legacyC')->getJson('/api/fan/me')->assertStatus(401);
    expect(FanSessionRow::where('fan_account_id', $fan->id)->count())->toBe(1);
});

it('mails the fan, and a mail failure does not fail the change', function () {
    $fan = FanAccount::factory()->create(['password_hash' => null]);

    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp down'));

    putPassword(fanToken($fan), ['password' => 'new password'])->assertOk();
    expect(Hash::check('new password', $fan->fresh()->password_hash))->toBeTrue();
});

it('writes the mail in the request language', function () {
    Mail::fake();
    $fan = FanAccount::factory()->create(['password_hash' => null]);

    $this->withHeader('Accept-Language', 'pl')->withToken(fanToken($fan))
        ->putJson('/api/fan/me/password', ['password' => 'new password'])->assertOk();

    Mail::assertSent(FanPasswordChanged::class, function ($m) {
        return str_contains($m->render(), 'hasło') && str_contains($m->envelope()->subject, 'hasło');
    });
});

it('reports password_needs_current in /fan/me', function () {
    $none = FanAccount::factory()->create(['password_hash' => null]);
    $has  = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);

    $this->withToken(fanToken($none, 'google'))->getJson('/api/fan/me')->assertJsonPath('password_needs_current', false);
    $this->withToken(fanToken($has, 'google'))->getJson('/api/fan/me')->assertJsonPath('password_needs_current', true);
});

it('requires a fan session', function () {
    $this->putJson('/api/fan/me/password', ['password' => 'new password'])->assertStatus(401);
});

it('asks for the current password when one was set while this request was on its way', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => null]);
    $token = fanToken($fan, 'google');
    beforeFanLock(fn () => DB::table('fan_accounts')->where('id', $fan->id)->update(['password_hash' => Hash::make('set elsewhere')]));

    putPassword($token, ['password' => 'new password'])->assertStatus(422)->assertJsonValidationErrors('current_password');

    expect(Hash::check('new password', (string) $fan->fresh()->password_hash))->toBeFalse();
    expect(FanSessionRow::count())->toBe(1);
    Mail::assertNothingSent();
});

it('checks the current password against the one in force when the change is made', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');
    beforeFanLock(fn () => DB::table('fan_accounts')->where('id', $fan->id)->update(['password_hash' => Hash::make('changed elsewhere')]));

    putPassword($token, ['password' => 'new password', 'current_password' => 'old password'])
        ->assertStatus(422)->assertJsonValidationErrors('current_password');

    expect(Hash::check('new password', (string) $fan->fresh()->password_hash))->toBeFalse();
    Mail::assertNothingSent();
});

it('refuses a change from a session that was signed out while it was on its way', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'link');
    beforeFanLock(fn () => FanSessionRow::query()->delete());

    putPassword($token, ['password' => 'new password'])->assertStatus(401);

    expect(Hash::check('old password', $fan->fresh()->password_hash))->toBeTrue();
    Mail::assertNothingSent();
});

it('mails only once the change is committed', function () {
    $fan   = FanAccount::factory()->create(['password_hash' => null]);
    $level = DB::transactionLevel();
    $seen  = null;
    Mail::shouldReceive('to')->once()->andReturnUsing(function () use (&$seen) {
        $seen = DB::transactionLevel();
        throw new RuntimeException('stop here');
    });

    putPassword(fanToken($fan), ['password' => 'new password'])->assertOk();

    expect($seen)->toBe($level);
});

it('stops after 10 wrong current passwords, even for the right one', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');

    foreach (range(1, 10) as $i) {
        // Another address each time, so the route's own throttle never decides.
        $this->withServerVariables(['REMOTE_ADDR' => "10.1.0.$i"]);
        putPassword($token, ['password' => 'new password', 'current_password' => "guess $i"])->assertStatus(422);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.1.0.99']);
    putPassword($token, ['password' => 'new password', 'current_password' => 'old password'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'login_limit')
        ->assertJsonPath('message', __('api.fan.password_limit'));
    expect(Hash::check('old password', $fan->fresh()->password_hash))->toBeTrue();
    Mail::assertNothingSent();
});

it('counts wrong guesses per fan, whichever of their sessions made them', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $other = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    RateLimiter::increment("fan-current-password:{$fan->id}", 900, 9);

    putPassword(fanToken($fan, 'password'), ['password' => 'new password', 'current_password' => 'nope'])->assertStatus(422);
    putPassword(fanToken($fan, 'google'), ['password' => 'new password', 'current_password' => 'old password'])->assertStatus(429);
    putPassword(fanToken($other, 'google'), ['password' => 'new password', 'current_password' => 'old password'])->assertOk();
});

it('counts only wrong guesses: a missing current password is not one', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');
    $key   = "fan-current-password:{$fan->id}";

    putPassword($token, ['password' => 'new password'])->assertStatus(422);
    putPassword($token, ['password' => 'new password', 'current_password' => ''])->assertStatus(422);
    putPassword($token, ['password' => 'short', 'current_password' => 'nope'])->assertStatus(422);
    expect((int) RateLimiter::attempts($key))->toBe(0);

    putPassword($token, ['password' => 'new password', 'current_password' => 'nope'])->assertStatus(422);
    expect((int) RateLimiter::attempts($key))->toBe(1);
});

it('forgets the wrong guesses once the password is changed', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');
    RateLimiter::increment("fan-current-password:{$fan->id}", 900, 9);

    putPassword($token, ['password' => 'new password', 'current_password' => 'old password'])->assertOk();

    expect((int) RateLimiter::attempts("fan-current-password:{$fan->id}"))->toBe(0);
});

it('still lets a fresh link session change the password when the guesses are used up', function () {
    Mail::fake();
    $fan = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    RateLimiter::increment("fan-current-password:{$fan->id}", 900, 10);

    putPassword(fanToken($fan, 'link'), ['password' => 'new password'])->assertOk();

    expect(Hash::check('new password', $fan->fresh()->password_hash))->toBeTrue();
});

it('words the limit in Polish too', function () {
    $fan = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    RateLimiter::increment("fan-current-password:{$fan->id}", 900, 10);

    $message = $this->withHeader('Accept-Language', 'pl')->withToken(fanToken($fan, 'password'))
        ->putJson('/api/fan/me/password', ['password' => 'new password', 'current_password' => 'old password'])
        ->assertStatus(429)->json('message');

    expect($message)->toContain('hasł')->not->toContain('api.fan');
});

it('changes a password once when its transaction is run again after a deadlock', function () {
    Mail::fake();
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');
    fanToken($fan, 'google');
    $attempts = rerunTransactions();

    putPassword($token, ['password' => 'new password', 'current_password' => 'old password'])->assertOk();

    expect($attempts())->toBe([3]);
    expect(Hash::check('new password', $fan->fresh()->password_hash))->toBeTrue();
    expect(FanSessionRow::sole()->token_hash)->toBe(hash('sha256', $token));
    Mail::assertSent(FanPasswordChanged::class, 1);
});

it('counts one wrong guess when its transaction is run again after a deadlock', function () {
    $fan   = FanAccount::factory()->create(['password_hash' => Hash::make('old password')]);
    $token = fanToken($fan, 'password');
    rerunTransactions();

    putPassword($token, ['password' => 'new password', 'current_password' => 'nope'])
        ->assertStatus(422)->assertJsonValidationErrors('current_password');

    expect((int) RateLimiter::attempts("fan-current-password:{$fan->id}"))->toBe(1);
});
