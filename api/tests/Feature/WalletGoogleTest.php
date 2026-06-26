<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// ── GET /api/tickets/{uuid}/wallet/google ─────────────────────────────────────

describe('GET /api/tickets/{uuid}/wallet/google', function () {
    it('returns 200 JSON when Google Wallet is disabled (default)', function () {
        config(['services.google_wallet.enabled' => false]);

        $venue      = Venue::factory()->create(['name' => 'Rockhaus']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'General Admission',
            'sort_order' => 0,
        ]);
        $uuid = (string) Str::uuid();
        Ticket::create([
            'uuid'                   => $uuid,
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'fan@example.com',
            'holder_name'            => 'Jane Fan',
        ]);

        $response = $this->get("/api/tickets/{$uuid}/wallet/google");

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Google Wallet not configured']);
    });

    it('response JSON contains the correct uuid key when disabled', function () {
        config(['services.google_wallet.enabled' => false]);

        $venue      = Venue::factory()->create(['name' => 'Arena']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-10-10']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'VIP',
            'sort_order' => 0,
        ]);
        $uuid = (string) Str::uuid();
        Ticket::create([
            'uuid'                   => $uuid,
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'vip@example.com',
            'holder_name'            => 'VIP Guest',
        ]);

        $response = $this->get("/api/tickets/{$uuid}/wallet/google");

        $response->assertStatus(200);
        $response->assertJsonFragment(['uuid' => $uuid]);
    });

    it('returns 404 for an unknown uuid', function () {
        $uuid = (string) Str::uuid();

        $this->get("/api/tickets/{$uuid}/wallet/google")->assertNotFound();
    });

    it('returns 404 for an invalid uuid format', function () {
        $this->get('/api/tickets/not-a-uuid/wallet/google')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        config(['services.google_wallet.enabled' => false]);

        $venue      = Venue::factory()->create(['name' => 'Stadium']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-11-15']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'Standing',
            'sort_order' => 0,
        ]);
        $uuid = (string) Str::uuid();
        Ticket::create([
            'uuid'                   => $uuid,
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'guest@example.com',
            'holder_name'            => 'Guest User',
        ]);

        // No auth header — should still succeed
        $this->get("/api/tickets/{$uuid}/wallet/google")->assertStatus(200);
    });
});
