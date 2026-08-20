<?php

use App\Enums\OrderStatus;
use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ShopItem;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// ── GET /api/tickets/{uuid}/qr ────────────────────────────────────────────────

describe('GET /api/tickets/{uuid}/qr', function () {
    it('returns a PNG image for a valid ticket uuid', function () {
        $venue      = Venue::factory()->create(['name' => 'Rockhaus']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'GA',
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

        $response = $this->get("/api/tickets/{$uuid}/qr");

        $response->assertStatus(200);
        expect($response->headers->get('Content-Type'))->toContain('image/png');
    });

    it('returns 404 for an unknown uuid', function () {
        $this->get('/api/tickets/00000000-0000-0000-0000-000000000000/qr')->assertNotFound();
    });

    it('returns 404 for an invalid uuid format', function () {
        $this->get('/api/tickets/not-a-uuid/qr')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-10-10']);
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
        $this->get("/api/tickets/{$uuid}/qr")->assertStatus(200);
    });
});

// ── GET /api/orders/{uuid} — ticket_uuids in items ───────────────────────────

describe('GET /api/orders/{uuid} includes ticket_uuids for ticket items', function () {
    it('includes ticket_uuids array for ticket order items', function () {
        $this->createProfile();

        $venue      = Venue::factory()->create(['name' => 'Test Venue']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-01']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'VIP',
            'sort_order' => 0,
        ]);

        $shopItem = ShopItem::factory()->create();
        $order    = Order::factory()->create(['status' => OrderStatus::Paid]);

        $ticketItem = OrderItem::create([
            'order_id'               => $order->id,
            'shop_item_id'           => $shopItem->id,
            'concert_ticket_type_id' => $ticketType->id,
            'name'                   => 'VIP Ticket',
            'price'                  => 50.00,
            'currency'               => 'PLN',
            'quantity'               => 1,
        ]);

        $ticketUuid = (string) Str::uuid();
        Ticket::create([
            'uuid'                   => $ticketUuid,
            'order_item_id'          => $ticketItem->id,
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'fan@example.com',
            'holder_name'            => 'Fan Name',
        ]);

        $response = $this->getJson("/api/orders/{$order->uuid}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.items.0.concert_ticket_type_id', $ticketType->id);
        $response->assertJsonPath('data.items.0.ticket_uuids.0', $ticketUuid);
    });

    it('does not include ticket_uuids for non-ticket order items', function () {
        $this->createProfile();

        $shopItem = ShopItem::factory()->create();
        $order    = Order::factory()->create(['status' => OrderStatus::Paid]);

        OrderItem::create([
            'order_id'               => $order->id,
            'shop_item_id'           => $shopItem->id,
            'concert_ticket_type_id' => null,
            'name'                   => 'T-Shirt',
            'price'                  => 25.00,
            'currency'               => 'PLN',
            'quantity'               => 2,
        ]);

        $response = $this->getJson("/api/orders/{$order->uuid}");

        $response->assertStatus(200);
        $data = $response->json('data.items.0');
        expect($data)->not->toHaveKey('ticket_uuids');
        expect($data['concert_ticket_type_id'])->toBeNull();
    });
});
