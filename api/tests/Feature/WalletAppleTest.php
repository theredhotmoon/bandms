<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// ── GET /api/tickets/{uuid}/wallet/apple ─────────────────────────────────────

describe('GET /api/tickets/{uuid}/wallet/apple', function () {
    it('returns a pkpass for a valid ticket uuid', function () {
        $venue      = Venue::factory()->create(['name' => 'Rockhaus']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);
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
            'holder_email'           => 'fan@example.com',
            'holder_name'            => 'Jane Fan',
        ]);

        $response = $this->get("/api/tickets/{$uuid}/wallet/apple");

        $response->assertStatus(200);
        expect($response->headers->get('Content-Type'))->toContain('application/vnd.apple.pkpass');
    });

    it('returns 404 for an unknown uuid', function () {
        $uuid = (string) Str::uuid();

        $this->get("/api/tickets/{$uuid}/wallet/apple")->assertNotFound();
    });

    it('returns 404 for an invalid uuid format', function () {
        $this->get('/api/tickets/not-a-uuid/wallet/apple')->assertNotFound();
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
        $this->get("/api/tickets/{$uuid}/wallet/apple")->assertStatus(200);
    });

    it('response has correct content disposition filename containing the uuid', function () {
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

        $response = $this->get("/api/tickets/{$uuid}/wallet/apple");

        $response->assertStatus(200);
        $disposition = $response->headers->get('Content-Disposition');
        expect($disposition)->toContain("ticket-{$uuid}.pkpass");
    });

    it('response body is a valid ZIP archive containing pass.json', function () {
        $venue      = Venue::factory()->create(['name' => 'Arena']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'Floor',
            'sort_order' => 0,
        ]);
        $uuid = (string) Str::uuid();
        Ticket::create([
            'uuid'                   => $uuid,
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'arena@example.com',
            'holder_name'            => 'Arena Fan',
        ]);

        $response = $this->get("/api/tickets/{$uuid}/wallet/apple");
        $response->assertStatus(200);

        // Write ZIP to a temp file and inspect it
        $tmpPath = tempnam(sys_get_temp_dir(), 'pkpass_test_') . '.zip';
        file_put_contents($tmpPath, $response->getContent());

        $zip = new ZipArchive();
        $opened = $zip->open($tmpPath);
        expect($opened)->toBe(true);

        // Must contain pass.json and manifest.json
        expect($zip->locateName('pass.json'))->not->toBeFalse();
        expect($zip->locateName('manifest.json'))->not->toBeFalse();

        // pass.json must contain the ticket uuid
        $passJson = json_decode($zip->getFromName('pass.json'), true);
        expect($passJson['serialNumber'])->toBe($uuid);
        expect($passJson['barcode']['message'])->toBe($uuid);

        $zip->close();
        @unlink($tmpPath);
    });
});
