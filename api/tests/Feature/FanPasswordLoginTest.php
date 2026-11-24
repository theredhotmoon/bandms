<?php

use App\Models\FanAccount;
use App\Models\FanSessionRow;
use App\Support\FanPassword;
use App\Http\Controllers\FanAuthController;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;

/** One request from a given address, so the per-IP route throttle never decides the outcome. */
function loginFrom(string $ip, string $email, string $password)
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/fan/auth/login', ['email' => $email, 'password' => $password]);
}

beforeEach(function () {
    RateLimiter::clear('fan-login:' . sha1('fan@example.com'));
});

it('signs a fan in with the right password', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);

    $res = $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])->assertOk();

    expect($res->json('fan.has_password'))->toBeTrue();
    expect(FanSessionRow::sole()->method)->toBe('password');
    $this->withToken($res->json('token'))->getJson('/api/fan/me')->assertOk();
});

it('answers the same for a wrong password, an unknown email and an account with no password', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);
    FanAccount::factory()->create(['email' => 'linkonly@example.com', 'password_hash' => null]);

    $bodies = collect([
        ['fan@example.com', 'wrong password'],
        ['nobody@example.com', 'correct horse'],
        ['linkonly@example.com', 'correct horse'],
    ])->map(function ($c) {
        $res = $this->postJson('/api/fan/auth/login', ['email' => $c[0], 'password' => $c[1]])->assertStatus(422);
        expect($res->json('code'))->toBe('login_failed');

        return $res->json();
    });

    expect($bodies->unique()->count())->toBe(1);
    expect(FanSessionRow::count())->toBe(0);
});

it('finds the account whatever case the email is typed in', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);

    $this->postJson('/api/fan/auth/login', ['email' => ' Fan@Example.COM ', 'password' => 'correct horse'])->assertOk();
});

it('stops after 10 failures for one email, from any address', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);

    foreach (range(1, 10) as $i) {
        loginFrom("10.0.0.$i", 'fan@example.com', 'nope')->assertStatus(422);
    }

    loginFrom('10.0.0.99', 'fan@example.com', 'correct horse')
        ->assertStatus(429)
        ->assertJsonPath('code', 'login_limit');
});

it('clears the failure count on success', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);

    foreach (range(1, 9) as $i) {
        loginFrom("10.0.1.$i", 'fan@example.com', 'nope')->assertStatus(422);
    }
    loginFrom('10.0.1.50', 'fan@example.com', 'correct horse')->assertOk();

    foreach (range(1, 9) as $i) {
        loginFrom("10.0.2.$i", 'fan@example.com', 'nope')->assertStatus(422);
    }
    loginFrom('10.0.2.50', 'fan@example.com', 'correct horse')->assertOk();
});

it('never puts password_hash in a response', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);

    $res = $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])->assertOk();

    expect($res->getContent())->not->toContain('password_hash')->not->toContain('$2y$');
});

it('refuses a password longer than 72 bytes', function () {
    expect(Validator::make(['p' => str_repeat('ż', 40)], ['p' => FanPassword::rules()])->fails())->toBeTrue();
    expect(Validator::make(['p' => str_repeat('a', 72)], ['p' => FanPassword::rules()])->passes())->toBeTrue();
    expect(Validator::make(['p' => 'short'], ['p' => FanPassword::rules()])->fails())->toBeTrue();
});

it('normalises the email the magic link looks up', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com']);

    $this->postJson('/api/fan/auth/magic-link', ['email' => 'Fan@Example.com'])->assertOk();

    expect(FanAccount::count())->toBe(1);
});

it('opens no session when the password changed after it was checked', function () {
    $fan  = FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);
    $done = false;
    Event::listen(TransactionBeginning::class, function () use (&$done, $fan) {
        if (! $done) {
            $done = true;
            DB::table('fan_accounts')->where('id', $fan->id)->update(['password_hash' => Hash::make('changed elsewhere')]);
        }
    });

    $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])
        ->assertStatus(422)->assertJsonPath('code', 'login_failed');

    expect(FanSessionRow::count())->toBe(0);
});

it('checks a miss against a real bcrypt hash of the cost passwords are hashed at in production', function () {
    $dummy = (new ReflectionClassConstant(FanAuthController::class, 'DUMMY_HASH'))->getValue();

    expect(password_get_info($dummy))->toMatchArray(['algoName' => 'bcrypt', 'options' => ['cost' => 12]]);
    expect(strlen($dummy))->toBe(60);
    // A malformed salt makes crypt() answer "*0" at once, with no work done.
    expect(crypt('anything', $dummy))->toStartWith('$2y$12$')->toHaveLength(60);
});

it('reports has_password false for a link-only fan', function () {
    $fan = FanAccount::factory()->create(['password_hash' => null]);

    $this->withToken(fanToken($fan))->getJson('/api/fan/me')->assertOk()->assertJsonPath('has_password', false);
});

it('refuses a password holding a NUL byte, which bcrypt cannot hash', function () {
    $bad = "correct\0horse";
    expect(Validator::make(['p' => $bad], ['p' => FanPassword::rules()])->fails())->toBeTrue();

    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => $bad])
        ->assertStatus(422)->assertJsonValidationErrors('password');
    $this->withToken(fanToken(FanAccount::factory()->create()))->putJson('/api/fan/me/password', ['password' => $bad])
        ->assertStatus(422)->assertJsonValidationErrors('password');
});

it('words every password error in the fan\'s language', function (string $password) {
    foreach (['pl', 'en'] as $lang) {
        $messages[$lang] = $this->withHeader('Accept-Language', $lang)
            ->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => $password])
            ->assertStatus(422)->json('errors.password');
    }

    expect($messages['pl'])->not->toBeEmpty();
    foreach ($messages['pl'] as $message) {
        expect(mb_strtolower($message))->toContain('hasło')->not->toContain('password')->not->toContain('field')->not->toContain('validation.');
    }
    foreach ($messages['en'] as $message) {
        expect($message)->toContain('password')->not->toContain('validation.');
    }
})->with([
    'missing'        => [''],
    'too short'      => ['short'],
    'too long'       => [str_repeat('a', 80)],
    'too many bytes' => [str_repeat('ż', 40)],
    'NUL byte'       => ["correct\0horse"],
]);

it('names the current password in Polish too', function () {
    $fan = FanAccount::factory()->create(['password_hash' => Hash::make('correct horse')]);

    $message = $this->withHeader('Accept-Language', 'pl')->withToken(fanToken($fan))
        ->putJson('/api/fan/me/password', ['password' => 'new password', 'current_password' => str_repeat('a', 201)])
        ->assertStatus(422)->json('errors.current_password.0');

    expect($message)->toContain('hasło')->not->toContain('password');
});

it('opens one session when its transaction is run again after a deadlock', function () {
    FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);
    $attempts = rerunTransactions();

    $res = $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])->assertOk();

    expect($attempts())->toBe([3]);
    expect(FanSessionRow::sole()->token_hash)->toBe(hash('sha256', $res->json('token')));
});

it('says once, in terms a fan can act on, that a password is too long', function (string $password) {
    foreach (['en', 'pl'] as $lang) {
        $messages = $this->withHeader('Accept-Language', $lang)
            ->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => $password])
            ->assertStatus(422)->json('errors.password');

        expect($messages)->toHaveCount(1);
        expect($messages[0])->toBe(__('api.fan.password_too_long', ['max' => 72], $lang))
            ->toContain('72');
    }
})->with([
    'too many characters'       => [str_repeat('a', 80)],
    'too many bytes'            => [str_repeat('ż', 40)],
    'too long with a NUL byte'  => [str_repeat('a', 80) . "\0"],
]);
