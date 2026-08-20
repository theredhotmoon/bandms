<?php

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;

/*
 * POST /api/auth/login is the one endpoint where guessing is the attack, so its
 * rate limit is a security control and not a convenience. It had no coverage
 * until now — the limit was an inline `throttle:10,1` that nothing asserted, so
 * raising or dropping it would have been silent.
 *
 * It is now the named "login" limiter, sized from config('auth.login_max_attempts')
 * so the E2E suite can raise it locally without weakening the production default.
 * These tests pin both halves: that the limit is enforced, and that it is the
 * config value being enforced rather than a hardcoded number.
 */

beforeEach(function () {
    RateLimiter::clear('login');
});

function attemptLogin(string $password = 'wrong-password')
{
    return test()->postJson('/api/auth/login', [
        'email'    => 'throttle@bandms.test',
        'password' => $password,
    ]);
}

it('allows attempts up to the configured limit', function () {
    config(['auth.login_max_attempts' => 3]);

    foreach (range(1, 3) as $i) {
        expect(attemptLogin()->status())->not->toBe(429);
    }
});

it('returns 429 once the configured limit is exceeded', function () {
    config(['auth.login_max_attempts' => 3]);

    foreach (range(1, 3) as $i) {
        attemptLogin();
    }

    attemptLogin()
        ->assertStatus(429)
        ->assertJsonPath('message', 'Too Many Attempts.');
});

it('takes the limit from config rather than a hardcoded value', function () {
    config(['auth.login_max_attempts' => 1]);

    expect(attemptLogin()->status())->not->toBe(429);
    attemptLogin()->assertStatus(429);
});

it('still rejects bad credentials with 401 while under the limit', function () {
    config(['auth.login_max_attempts' => 10]);

    User::factory()->create([
        'email' => 'throttle@bandms.test',
        'role'  => 'member',
    ]);

    attemptLogin('definitely-not-the-password')->assertUnauthorized();
});
