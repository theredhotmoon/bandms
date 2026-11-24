<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');

/**
 * A valid `Stripe-Signature` header for a webhook payload. Lives here, not in
 * CheckoutTest: TicketCheckoutTest calls it too, and a function declared in
 * another test file exists only when that file happens to load first — which
 * a parallel run does not promise.
 */
function makeStripeSignature(string $payload, string $secret): string
{
    $timestamp = time();
    $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
    return "t={$timestamp},v1={$signature}";
}

/**
 * Run every DB::transaction() the way a deadlock's victim does: the closure once, rolled
 * back, then again for real. The suite's own outer transaction keeps Laravel from retrying
 * a nested one, so the retry is played here. Returns the attempts each call asked for.
 */
function rerunTransactions(): Closure
{
    $asked      = new ArrayObject();
    $connection = Illuminate\Support\Facades\DB::connection();
    $mock       = Mockery::mock(app('db'));
    $mock->shouldReceive('transaction')->andReturnUsing(function (Closure $work, int $attempts = 1) use ($asked, $connection) {
        $asked[] = $attempts;
        $connection->beginTransaction();
        try {
            $work($connection);
        } catch (Throwable) {
            // A deadlock and the closure's own refusal both end in the rollback.
        }
        $connection->rollBack();

        return $connection->transaction($work);
    });
    Illuminate\Support\Facades\DB::swap($mock);

    return fn (): array => $asked->getArrayCopy();
}

/** Open a real fan session for tests and return its raw Bearer token. */
function fanToken(App\Models\FanAccount $fan, string $method = 'link'): string
{
    return App\Support\FanSession::open($fan, $method);
}
