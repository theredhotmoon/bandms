<?php

use Illuminate\Support\Facades\RateLimiter;

/*
 * The fan sign-in limit must be the fan sign-in limit.
 *
 * Laravel keys an inline `throttle:5,1` on sha1(domain|ip) — the route plays no
 * part — so every inline-throttled endpoint in routes/api.php shares one counter
 * per visitor and only the ceiling differs. Sign-in has the smallest ceiling of
 * the fan routes, so it was the first thing to break: a fan who had loaded a few
 * availability months or looked up an order had already spent all five attempts
 * and got a 429 before typing an address. The whole portal was unreachable, and
 * nothing asserted otherwise because these routes had no coverage at all.
 *
 * The three fan-facing routes now pass an explicit prefix. These tests pin the
 * property that prefix buys — isolation — rather than the number, which is the
 * part that would silently rot back.
 */

beforeEach(function () {
    RateLimiter::clear('fan-magic-link');
    RateLimiter::clear('ticket-claim');
});

it('does not spend the sign-in limit on unrelated throttled routes', function () {
    // Well past magic-link's ceiling of 5, on a route that has nothing to do
    // with it. Before the prefix, the sixth of these made sign-in unreachable.
    foreach (range(1, 10) as $i) {
        $this->postJson('/api/presale-codes/validate', ['code' => 'nope']);
    }

    $this->postJson('/api/fan/auth/magic-link', ['email' => 'fan@bandms.test'])
        ->assertStatus(200);
});

it('does not spend the claim limit on unrelated throttled routes', function () {
    foreach (range(1, 25) as $i) {
        $this->postJson('/api/presale-codes/validate', ['code' => 'nope']);
    }

    // 404 because the token is not real — the point is that it is not a 429.
    $this->postJson('/api/tickets/claim/definitely-not-a-real-token')
        ->assertStatus(404);
});

it('still enforces the sign-in limit on its own route', function () {
    // Isolation must not become "no limit". Sign-in is where guessing an
    // address to fish for accounts would happen.
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/fan/auth/magic-link', ['email' => 'fan@bandms.test'])
            ->assertStatus(200);
    }

    $this->postJson('/api/fan/auth/magic-link', ['email' => 'fan@bandms.test'])
        ->assertStatus(429);
});
