<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Concert;
use App\Models\ConcertTicketPriceTier;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Fixture for the Playwright ticket specs.
 *
 * Tickets are minted only by the signed Stripe webhook, and Stripe is not
 * configured in the local stack — so nothing in the running app can produce an
 * issued ticket for a browser test to scan. This builds one directly.
 *
 * Everything it creates is prefixed "e2e-" and it only ever inserts, so a stray
 * run adds recognisable junk rather than destroying anything. It still asks for
 * confirmation in production (ConfirmableTrait) because junk in a real venue's
 * concert list is nobody's idea of a good afternoon. Note the local backend
 * container runs with APP_ENV=production, so guarding on the environment would
 * block the very case this exists for — hence --force rather than an env check.
 */
class SeedE2eTicket extends Command
{
    use ConfirmableTrait;

    protected $signature = 'e2e:seed-ticket
                            {--tickets=1 : How many issued tickets to mint}
                            {--force : Skip the production confirmation}';

    protected $description = 'Create a paid order with issued tickets for the E2E suite, and print the identifiers as JSON';

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $stamp = now()->format('YmdHis');
        $count = max(1, (int) $this->option('tickets'));

        $payload = DB::transaction(function () use ($stamp, $count) {
            $venue = Venue::create([
                'name' => "e2e-venue-{$stamp}",
                'city' => 'Testville',
            ]);

            // Dated well ahead so the ticket type counts as on sale: with no
            // explicit on_sale_until, the concert date is the implicit deadline.
            $concert = Concert::create([
                'venue_id' => $venue->id,
                'date'     => now()->addYear()->toDateString(),
            ]);

            $ticketType = ConcertTicketType::create([
                'concert_id'    => $concert->id,
                'name'          => "e2e-type-{$stamp}",
                'max_per_order' => 4,
                'sort_order'    => 0,
            ]);

            ConcertTicketPriceTier::create([
                'concert_ticket_type_id' => $ticketType->id,
                'name'                   => 'e2e-tier',
                'price'                  => 25.00,
                'currency'               => 'EUR',
                'sort_order'             => 0,
            ]);

            $fanEmail = "e2e-fan-{$stamp}@bandms.test";

            $fan = FanAccount::create([
                'email'                 => $fanEmail,
                'name'                  => "e2e-fan-{$stamp}",
                'newsletter_subscribed' => false,
            ]);

            // doorCheck refuses anything whose order is not paid, so the order
            // has to land in the same state the Stripe webhook would leave it.
            $order = Order::create([
                'uuid'     => (string) Str::uuid(),
                'email'    => $fanEmail,
                'name'     => "e2e-buyer-{$stamp}",
                'status'   => OrderStatus::Paid,
                'currency' => 'EUR',
                'total'    => 25.00 * $count,
            ]);

            $item = OrderItem::create([
                'order_id'               => $order->id,
                'concert_ticket_type_id' => $ticketType->id,
                'name'                   => $ticketType->name,
                'price'                  => 25.00,
                'currency'               => 'EUR',
                'quantity'               => $count,
            ]);

            $uuids = [];
            foreach (range(1, $count) as $_) {
                $uuids[] = Ticket::create([
                    'uuid'                   => (string) Str::uuid(),
                    'order_item_id'          => $item->id,
                    'concert_ticket_type_id' => $ticketType->id,
                    'status'                 => 'active',
                    'holder_email'           => $fanEmail,
                    'holder_name'            => $fan->name,
                    'fan_account_id'         => $fan->id,
                ])->uuid;
            }

            return [
                'ticket_uuid'    => $uuids[0],
                'ticket_uuids'   => $uuids,
                'concert_id'     => $concert->id,
                'ticket_type_id' => $ticketType->id,
                'ticket_type'    => $ticketType->name,
                'venue_name'     => $venue->name,
                'fan_email'      => $fanEmail,
                'fan_name'       => $fan->name,
                'order_uuid'     => $order->uuid,
            ];
        });

        // stdout is the fixture's transport back to Playwright — keep it to
        // exactly one line of JSON and nothing else.
        $this->line(json_encode($payload, JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }
}
