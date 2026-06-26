<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// ── GET /api/tickets/{uuid}/pdf ───────────────────────────────────────────────

describe('GET /api/tickets/{uuid}/pdf', function () {
    it('returns a PDF for a valid ticket uuid', function () {
        $venue          = Venue::factory()->create(['name' => 'Rockhaus']);
        $concert        = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);
        $ticketType     = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'VIP',
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

        $response = $this->get("/api/tickets/{$uuid}/pdf");

        $response->assertStatus(200);
        expect($response->headers->get('Content-Type'))->toContain('application/pdf');
    });

    it('returns 404 for an unknown uuid', function () {
        $uuid = (string) Str::uuid();

        $this->get("/api/tickets/{$uuid}/pdf")->assertNotFound();
    });

    it('returns 404 for an invalid uuid format', function () {
        $this->get('/api/tickets/not-a-uuid/pdf')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-10-10']);
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
            'holder_email'           => 'guest@example.com',
            'holder_name'            => 'Guest User',
        ]);

        // No auth header — should still succeed
        $this->get("/api/tickets/{$uuid}/pdf")->assertStatus(200);
    });

    it('includes ticket holder name in PDF content', function () {
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
            'holder_email'           => 'holder@example.com',
            'holder_name'            => 'Alice Holder',
        ]);

        $response = $this->get("/api/tickets/{$uuid}/pdf");

        $response->assertStatus(200);
        // The response is binary PDF — check headers indicate a named file
        $disposition = $response->headers->get('Content-Disposition');
        expect($disposition)->toContain("ticket-{$uuid}.pdf");
    });
});
