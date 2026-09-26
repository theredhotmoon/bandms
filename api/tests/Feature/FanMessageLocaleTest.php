<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Str;

/*
 * The fan surfaces print `body.message` straight into the page.
 *
 * Every message these routes returned was an English literal in the controller,
 * so a Polish fan read English under a Polish heading — the defect the
 * Accept-Language header was added to remove. They now go through
 * `__('api.fan.*')`, which `SetLocale` resolves from `?lang=` or the header the
 * fan API sends.
 *
 * These tests assert the *pairing* — that the response follows the request's
 * language — rather than the wording, so a copy edit does not fail them while a
 * message that stops being translated does.
 */

/** A fan session plus an active ticket they own. */
function localeFan(string $email = 'locale-fan@example.com'): array
{
    $fan   = FanAccount::create(['email' => $email, 'name' => 'Fan']);
    $token = Str::random(64);
    Cache::put("fan_session:{$token}", $fan->id, now()->addDays(30));

    return [$fan, $token];
}

/**
 * A ticket the fan owns.
 *
 * Deliberately not TicketTransferTest's `makeTicket`: that is a global declared
 * in another file, so reusing it would make this file's result depend on Pest's
 * collection order.
 */
function localeTicket(FanAccount $fan, string $status = 'active'): Ticket
{
    $venue      = Venue::factory()->create();
    $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);
    $ticketType = ConcertTicketType::create([
        'concert_id' => $concert->id,
        'name'       => 'GA',
        'sort_order' => 0,
    ]);

    return Ticket::create([
        'uuid'                   => (string) Str::uuid(),
        'concert_ticket_type_id' => $ticketType->id,
        'status'                 => $status,
        'holder_email'           => $fan->email,
        'holder_name'            => $fan->name,
        'fan_account_id'         => $fan->id,
    ]);
}

it('answers a transfer-to-self in the language the request asked for', function () {
    [$fan, $token] = localeFan();
    $ticket        = localeTicket($fan);

    $en = $this->postJson(
        "/api/fan/tickets/{$ticket->uuid}/transfer",
        ['to_email' => $fan->email],
        ['Authorization' => "Bearer {$token}", 'Accept-Language' => 'en'],
    );

    $pl = $this->postJson(
        "/api/fan/tickets/{$ticket->uuid}/transfer",
        ['to_email' => $fan->email],
        ['Authorization' => "Bearer {$token}", 'Accept-Language' => 'pl'],
    );

    $en->assertStatus(422);
    $pl->assertStatus(422);

    expect($en->json('message'))->toBe(__('api.fan.transfer_to_self', [], 'en'));
    expect($pl->json('message'))->toBe(__('api.fan.transfer_to_self', [], 'pl'));
    expect($pl->json('message'))->not->toBe($en->json('message'));
});

it('answers an inactive ticket in the language the request asked for', function () {
    [$fan, $token] = localeFan('inactive@example.com');
    $ticket        = localeTicket($fan, 'scanned');

    $pl = $this->postJson(
        "/api/fan/tickets/{$ticket->uuid}/transfer",
        ['to_email' => 'someone@example.com'],
        ['Authorization' => "Bearer {$token}", 'Accept-Language' => 'pl'],
    );

    $pl->assertStatus(422);
    expect($pl->json('message'))->toBe(__('api.fan.ticket_not_active', [], 'pl'));
});

it('answers someone else\'s ticket in the language the request asked for', function () {
    [$owner]        = localeFan('owner@example.com');
    [, $otherToken] = localeFan('other@example.com');
    $ticket         = localeTicket($owner);

    $pl = $this->postJson(
        "/api/fan/tickets/{$ticket->uuid}/transfer",
        ['to_email' => 'someone@example.com'],
        ['Authorization' => "Bearer {$otherToken}", 'Accept-Language' => 'pl'],
    );

    $pl->assertStatus(403);
    expect($pl->json('message'))->toBe(__('api.fan.ticket_not_owned', [], 'pl'));
});

it('prefers ?lang= over the header, the way SetLocale does', function () {
    [$fan, $token] = localeFan('query@example.com');
    $ticket        = localeTicket($fan);

    $response = $this->postJson(
        "/api/fan/tickets/{$ticket->uuid}/transfer?lang=pl",
        ['to_email' => $fan->email],
        ['Authorization' => "Bearer {$token}", 'Accept-Language' => 'en'],
    );

    $response->assertStatus(422);
    expect($response->json('message'))->toBe(__('api.fan.transfer_to_self', [], 'pl'));
});

it('answers a lapsed session in the language the request asked for', function () {
    // The ordinary way a fan meets a 401: sessions last 30 days and a cache
    // flush drops them early. FanAuth aborted with English literals, and
    // utils/fanErrors.ts prints any 4xx message the server wrote — so this was
    // "Invalid or expired session." under Polish chrome.
    $pl = $this->getJson('/api/fan/me', [
        'Authorization'   => 'Bearer not-a-real-session-token',
        'Accept-Language' => 'pl',
    ]);

    $pl->assertStatus(401);
    expect($pl->json('message'))->toBe(__('api.fan.session_expired', [], 'pl'));
});

it('answers a missing token in the language the request asked for', function () {
    $pl = $this->getJson('/api/fan/me', ['Accept-Language' => 'pl']);

    $pl->assertStatus(401);
    expect($pl->json('message'))->toBe(__('api.unauthenticated', [], 'pl'));
});

it('does not say which of the two session failures it was', function () {
    // A caller probing tokens learns nothing: a token with no session and a
    // session whose account is gone give the same sentence. The fan reads one
    // instruction either way — sign in again.
    [$fan, $token] = localeFan('vanished@example.com');
    $fan->delete();

    $response = $this->getJson('/api/fan/me', ['Authorization' => "Bearer {$token}"]);

    $response->assertStatus(401);
    expect($response->json('message'))->toBe(__('api.fan.session_expired', [], 'en'));
});

it('declares every fan message for both locales', function () {
    // The guard that matters: adding a key to lang/en/api.php's `fan` block
    // without a pl twin is what silently ships English to a Polish fan.
    //
    // Asserted through Lang::hasForLocale rather than by comparing the two
    // strings. "pl must differ from en" catches the same omissions but also
    // fails a translation that is legitimately identical — a proper noun, a
    // venue name, "OK" — and the only way to pass would be to detune the
    // Polish copy to satisfy a test.
    $en = __('api.fan', [], 'en');

    expect($en)->toBeArray()->not->toBeEmpty();

    foreach (array_keys($en) as $key) {
        expect(Lang::hasForLocale("api.fan.{$key}", 'pl'))
            ->toBeTrue("api.fan.{$key} is missing from lang/pl/api.php");
        expect(trim((string) __("api.fan.{$key}", [], 'pl')))->not->toBe('');
    }
});
