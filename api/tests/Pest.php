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
