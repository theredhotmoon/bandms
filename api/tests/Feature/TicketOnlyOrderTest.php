<?php

use App\Enums\OrderStatus;
use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Venue;
use Illuminate\Support\Str;

/*
 * A cart holding only tickets used to die on insert: order_items.shop_item_id
 * was NOT NULL, left over from when the table only ever held merch, while
 * CheckoutController builds a ticket line with no shop_item_id at all. Every
 * ticket-only purchase failed with SQLSTATE[HY000] 1364.
 *
 * The suite did not catch it because nothing posts a ticket checkout, and the
 * ticket tests that build order items attach a shop item to them — a shape the
 * application never produces. This test builds the line the way the controller
 * actually does, with no shop item anywhere near it.
 */

beforeEach(function () {
    // ShopItemFactory hangs items off profile_id 1.
    $this->createProfile();
});

function ticketOnlyOrder(): Order
{
    return Order::create([
        'uuid'     => (string) Str::uuid(),
        'email'    => 'ticket-only@bandms.test',
        'name'     => 'Ticket Only Buyer',
        'status'   => OrderStatus::Paid,
        'currency' => 'EUR',
        'total'    => 25.00,
    ]);
}

function aTicketType(): ConcertTicketType
{
    $venue   = Venue::factory()->create();
    $concert = Concert::create(['venue_id' => $venue->id, 'date' => now()->addMonth()->toDateString()]);

    return ConcertTicketType::create([
        'concert_id' => $concert->id,
        'name'       => 'General Admission',
        'sort_order' => 0,
    ]);
}

it('stores an order item for a ticket with no shop item attached', function () {
    $order      = ticketOnlyOrder();
    $ticketType = aTicketType();

    $item = OrderItem::create([
        'order_id'               => $order->id,
        'concert_ticket_type_id' => $ticketType->id,
        'name'                   => $ticketType->name,
        'price'                  => 25.00,
        'currency'               => 'EUR',
        'quantity'               => 1,
    ]);

    expect($item->shop_item_id)->toBeNull()
        ->and($item->concert_ticket_type_id)->toBe($ticketType->id);

    $this->assertDatabaseHas('order_items', [
        'id'                     => $item->id,
        'shop_item_id'           => null,
        'concert_ticket_type_id' => $ticketType->id,
    ]);
});

it('still stores a merch order item that has no ticket type', function () {
    // The column is nullable now; the merch path must be unaffected.
    $order = ticketOnlyOrder();

    $shopItem = \App\Models\ShopItem::factory()->create();

    $item = OrderItem::create([
        'order_id'     => $order->id,
        'shop_item_id' => $shopItem->id,
        'name'         => 'A T-shirt',
        'price'        => 20.00,
        'currency'     => 'EUR',
        'quantity'     => 1,
    ]);

    expect($item->concert_ticket_type_id)->toBeNull()
        ->and($item->shop_item_id)->toBe($shopItem->id);
});
