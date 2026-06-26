<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// ── Ticket delivery endpoints: status guard ───────────────────────────────────

describe('GET /api/tickets/{uuid}/pdf — status guard', function () {
    it('returns 410 for a voided ticket', function () {
        $fan        = FanAccount::create(['email' => 'pdftest@example.com', 'name' => 'PDF Fan']);
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'GA',
            'sort_order' => 0,
        ]);

        $ticket = Ticket::create([
            'uuid'                   => (string) Str::uuid(),
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'voided',
            'holder_email'           => 'pdftest@example.com',
            'holder_name'            => 'PDF Fan',
            'fan_account_id'         => $fan->id,
        ]);

        $this->getJson("/api/tickets/{$ticket->uuid}/pdf")
            ->assertStatus(410);
    });

    it('returns 410 for a transferred ticket', function () {
        $fan        = FanAccount::create(['email' => 'pdftransfer@example.com', 'name' => 'Transfer Fan']);
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'GA',
            'sort_order' => 0,
        ]);

        $ticket = Ticket::create([
            'uuid'                   => (string) Str::uuid(),
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'transferred',
            'holder_email'           => 'pdftransfer@example.com',
            'holder_name'            => 'Transfer Fan',
            'fan_account_id'         => $fan->id,
        ]);

        $this->getJson("/api/tickets/{$ticket->uuid}/pdf")
            ->assertStatus(410);
    });
});

describe('GET /api/tickets/{uuid}/qr — status guard', function () {
    it('returns 410 for a voided ticket', function () {
        $fan        = FanAccount::create(['email' => 'qrtest@example.com', 'name' => 'QR Fan']);
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'GA',
            'sort_order' => 0,
        ]);

        $ticket = Ticket::create([
            'uuid'                   => (string) Str::uuid(),
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'voided',
            'holder_email'           => 'qrtest@example.com',
            'holder_name'            => 'QR Fan',
            'fan_account_id'         => $fan->id,
        ]);

        $this->get("/api/tickets/{$ticket->uuid}/qr")
            ->assertStatus(410);
    });
});
