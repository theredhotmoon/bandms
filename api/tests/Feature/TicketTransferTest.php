<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Ticket;
use App\Models\TicketTransfer;
use App\Models\Venue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create an authenticated fan session and return [$fan, $sessionToken].
 */
function makeFan(string $email = 'fan@example.com', string $name = 'Fan'): array
{
    $fan          = FanAccount::create(['email' => $email, 'name' => $name]);
    $sessionToken = Str::random(64);
    Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

    return [$fan, $sessionToken];
}

/**
 * Create a minimal active ticket linked to a fan and return it.
 */
function makeTicket(FanAccount $fan, string $status = 'active'): Ticket
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

// ── Initiate transfer ──────────────────────────────────────────────────────

describe('POST /api/fan/tickets/{uuid}/transfer', function () {

    it('happy path: fan initiates transfer and gets dev_link', function () {
        [$fan, $token] = makeFan();
        $ticket        = makeTicket($fan);

        $response = $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => 'recipient@example.com'],
            ['Authorization' => "Bearer {$token}"],
        );

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'dev_link'])
            ->assertJsonPath('dev_link', fn ($v) => str_contains($v, '/api/tickets/claim/'));

        $this->assertDatabaseHas('ticket_transfers', [
            'from_ticket_id' => $ticket->id,
            'to_email'       => 'recipient@example.com',
        ]);
    });

    it('cannot transfer a non-active ticket (scanned)', function () {
        [$fan, $token] = makeFan('scanned@example.com');
        $ticket        = makeTicket($fan, 'scanned');

        $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => 'someone@example.com'],
            ['Authorization' => "Bearer {$token}"],
        )->assertStatus(422);
    });

    it('cannot transfer a ticket you do not own', function () {
        [$fan,]         = makeFan('owner@example.com');
        [$other, $token] = makeFan('intruder@example.com');
        $ticket          = makeTicket($fan);

        $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => 'anyone@example.com'],
            ['Authorization' => "Bearer {$token}"],
        )->assertStatus(403);
    });

    it('cannot transfer a ticket to yourself', function () {
        [$fan, $token] = makeFan('self@example.com');
        $ticket        = makeTicket($fan);

        $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => $fan->email],
            ['Authorization' => "Bearer {$token}"],
        )->assertStatus(422);
    });

    it('returns 422 when a pending transfer already exists', function () {
        [$fan, $token] = makeFan('dup@example.com');
        $ticket        = makeTicket($fan);

        // Create a still-active (not yet claimed, not expired) transfer
        TicketTransfer::create([
            'from_ticket_id' => $ticket->id,
            'to_email'       => 'first@example.com',
            'claim_token'    => Str::random(64),
            'expires_at'     => now()->addHours(48),
        ]);

        $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => 'second@example.com'],
            ['Authorization' => "Bearer {$token}"],
        )->assertStatus(422);
    });

    it('returns 401 when unauthenticated', function () {
        [$fan,] = makeFan('unauth@example.com');
        $ticket = makeTicket($fan);

        $this->postJson(
            "/api/fan/tickets/{$ticket->uuid}/transfer",
            ['to_email' => 'someone@example.com'],
        )->assertStatus(401);
    });
});

// ── Claim transfer ─────────────────────────────────────────────────────────

describe('POST /api/tickets/claim/{token}', function () {

    it('happy path: valid token claims the transfer, voids old ticket, mints new one', function () {
        [$fan,] = makeFan('claimer-owner@example.com');
        $ticket  = makeTicket($fan);

        $claimToken = Str::random(64);
        TicketTransfer::create([
            'from_ticket_id' => $ticket->id,
            'to_email'       => 'newowner@example.com',
            'claim_token'    => $claimToken,
            'expires_at'     => now()->addHours(48),
        ]);

        $response = $this->postJson("/api/tickets/claim/{$claimToken}");

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'ticket_uuid'])
            ->assertJsonPath('message', 'Ticket claimed successfully.');

        // Old ticket must be transferred
        $this->assertDatabaseHas('tickets', [
            'id'     => $ticket->id,
            'status' => 'transferred',
        ]);

        // New ticket must exist for the recipient
        $newUuid = $response->json('ticket_uuid');
        $this->assertDatabaseHas('tickets', [
            'uuid'         => $newUuid,
            'status'       => 'active',
            'holder_email' => 'newowner@example.com',
        ]);

        // Transfer must be stamped as claimed
        $this->assertDatabaseHas('ticket_transfers', [
            'claim_token' => $claimToken,
        ]);
        expect(TicketTransfer::where('claim_token', $claimToken)->value('claimed_at'))->not->toBeNull();
    });

    it('returns 404 for an invalid token', function () {
        $this->postJson('/api/tickets/claim/' . Str::random(64))
            ->assertStatus(404);
    });

    it('returns 409 when the transfer has already been claimed', function () {
        [$fan,] = makeFan('claimed-owner@example.com');
        $ticket  = makeTicket($fan);

        $claimToken = Str::random(64);
        TicketTransfer::create([
            'from_ticket_id' => $ticket->id,
            'to_email'       => 'already@example.com',
            'claim_token'    => $claimToken,
            'expires_at'     => now()->addHours(48),
            'claimed_at'     => now()->subMinutes(5),
        ]);

        $this->postJson("/api/tickets/claim/{$claimToken}")
            ->assertStatus(409);
    });

    it('returns 410 when the transfer has expired', function () {
        [$fan,] = makeFan('expired-owner@example.com');
        $ticket  = makeTicket($fan);

        $claimToken = Str::random(64);
        TicketTransfer::create([
            'from_ticket_id' => $ticket->id,
            'to_email'       => 'toolate@example.com',
            'claim_token'    => $claimToken,
            'expires_at'     => now()->subHours(1),
        ]);

        $this->postJson("/api/tickets/claim/{$claimToken}")
            ->assertStatus(410);
    });
});
