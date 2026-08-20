<?php

use App\Jobs\GenerateAppleWalletPass;
use App\Jobs\SendTicketConfirmationEmail;
use App\Jobs\SendTicketTransferNotification;
use App\Models\FanAccount;
use App\Models\Order;
use App\Models\Ticket;
use App\Models\TicketTransfer;
use App\Models\Venue;
use App\Models\Concert;
use App\Models\ConcertTicketType;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

// ── Job class instantiation ───────────────────────────────────────────────

it('SendTicketConfirmationEmail job can be instantiated', function () {
    $order = Order::factory()->create();

    $job = new SendTicketConfirmationEmail($order);

    expect($job->order->id)->toBe($order->id);
});

it('GenerateAppleWalletPass job can be instantiated', function () {
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
        'status'                 => 'active',
        'holder_email'           => 'fan@example.com',
        'holder_name'            => 'Fan',
    ]);

    $job = new GenerateAppleWalletPass($ticket);

    expect($job->ticket->id)->toBe($ticket->id);
});

it('SendTicketTransferNotification job can be instantiated', function () {
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
        'status'                 => 'active',
        'holder_email'           => 'fan@example.com',
        'holder_name'            => 'Fan',
    ]);
    $transfer = TicketTransfer::create([
        'from_ticket_id' => $ticket->id,
        'to_email'       => 'recipient@example.com',
        'claim_token'    => Str::random(64),
        'expires_at'     => now()->addHours(48),
    ]);

    $job = new SendTicketTransferNotification($transfer);

    expect($job->transfer->id)->toBe($transfer->id);
});

// ── Queue dispatch ────────────────────────────────────────────────────────

it('dispatches SendTicketConfirmationEmail', function () {
    Queue::fake();

    $order = Order::factory()->create();
    SendTicketConfirmationEmail::dispatch($order);

    Queue::assertPushed(SendTicketConfirmationEmail::class, function ($job) use ($order) {
        return $job->order->id === $order->id;
    });
});

it('dispatches GenerateAppleWalletPass', function () {
    Queue::fake();

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
        'status'                 => 'active',
        'holder_email'           => 'fan@example.com',
        'holder_name'            => 'Fan',
    ]);

    GenerateAppleWalletPass::dispatch($ticket);

    Queue::assertPushed(GenerateAppleWalletPass::class, function ($job) use ($ticket) {
        return $job->ticket->id === $ticket->id;
    });
});

it('dispatches SendTicketTransferNotification', function () {
    Queue::fake();

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
        'status'                 => 'active',
        'holder_email'           => 'fan@example.com',
        'holder_name'            => 'Fan',
    ]);
    $transfer = TicketTransfer::create([
        'from_ticket_id' => $ticket->id,
        'to_email'       => 'recipient@example.com',
        'claim_token'    => Str::random(64),
        'expires_at'     => now()->addHours(48),
    ]);

    SendTicketTransferNotification::dispatch($transfer);

    Queue::assertPushed(SendTicketTransferNotification::class, function ($job) use ($transfer) {
        return $job->transfer->id === $transfer->id;
    });
});
