<?php

use App\Models\Concert;
use App\Models\Order;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The purge has two jobs and the second one is the dangerous one: remove every
 * trace of a seeded fixture, and touch nothing else. Both are tested here, and
 * the fixtures are built by running the real seeder rather than by hand, so the
 * test cannot drift from the graph it is meant to clean up.
 */
function seedFixture(int $tickets = 1): void
{
    Artisan::call('e2e:seed-ticket', ['--tickets' => $tickets, '--force' => true]);
}

function e2eRowCounts(): array
{
    return [
        'venues' => DB::table('venues')->where('name', 'like', 'e2e-%')->count(),
        'concerts' => DB::table('concerts')->count(),
        'ticket_types' => DB::table('concert_ticket_types')->where('name', 'like', 'e2e-%')->count(),
        'price_tiers' => DB::table('concert_ticket_price_tiers')->count(),
        'fan_accounts' => DB::table('fan_accounts')->where('email', 'like', 'e2e-%')->count(),
        'orders' => DB::table('orders')->where('email', 'like', 'e2e-%')->count(),
        'order_items' => DB::table('order_items')->count(),
        'tickets' => DB::table('tickets')->count(),
    ];
}

it('removes every row the seeder created, across all eight tables', function () {
    seedFixture(3);

    expect(array_sum(e2eRowCounts()))->toBeGreaterThan(0);

    $this->artisan('e2e:purge', ['--force' => true])->assertSuccessful();

    expect(e2eRowCounts())->toBe([
        'venues' => 0, 'concerts' => 0, 'ticket_types' => 0, 'price_tiers' => 0,
        'fan_accounts' => 0, 'orders' => 0, 'order_items' => 0, 'tickets' => 0,
    ]);
});

it('leaves no orphans behind when the venue cascade fires', function () {
    // tickets and order_items reference ticket types with ON DELETE SET NULL, so
    // deleting venues first would blank those columns and strand the rows rather
    // than removing them. This is the regression guard for the deletion order.
    seedFixture(2);

    $this->artisan('e2e:purge', ['--force' => true])->assertSuccessful();

    expect(DB::table('tickets')->count())->toBe(0)
        ->and(DB::table('order_items')->count())->toBe(0);
});

it('does not touch real data', function () {
    $venue = Venue::create(['name' => 'Klub Studio', 'city' => 'Kraków']);
    $concert = Concert::create(['venue_id' => $venue->id, 'date' => now()->addMonth()->toDateString()]);
    $order = Order::create([
        'uuid' => (string) Str::uuid(), 'email' => 'fan@example.com', 'name' => 'A Fan',
        'status' => \App\Enums\OrderStatus::Paid, 'currency' => 'EUR', 'total' => 25.00,
    ]);

    seedFixture();

    $this->artisan('e2e:purge', ['--force' => true])->assertSuccessful();

    expect(Venue::find($venue->id))->not->toBeNull()
        ->and(Concert::find($concert->id))->not->toBeNull()
        ->and(Order::find($order->id))->not->toBeNull();
});

it('keeps fixtures younger than --older-than', function () {
    seedFixture();

    // Nothing from the current run is six hours old. This is what stops a seed
    // in one parallel worker from deleting a fixture another worker is using.
    $this->artisan('e2e:purge', ['--older-than' => 6, '--force' => true])->assertSuccessful();

    expect(DB::table('venues')->where('name', 'like', 'e2e-%')->count())->toBe(1);
});

it('removes fixtures once they are older than --older-than', function () {
    seedFixture();

    $this->travel(7)->hours();

    $this->artisan('e2e:purge', ['--older-than' => 6, '--force' => true])->assertSuccessful();

    expect(DB::table('venues')->where('name', 'like', 'e2e-%')->count())->toBe(0);
});

it('deletes nothing on a dry run', function () {
    seedFixture();
    $before = e2eRowCounts();

    $this->artisan('e2e:purge', ['--dry-run' => true])->assertSuccessful();

    expect(e2eRowCounts())->toBe($before);
});

it('removes a ticket that was transferred away from the e2e address', function () {
    seedFixture();

    // Holder email is no longer recognisable; the order it was bought on still
    // is. Matching only on holder_email would leave this row behind forever.
    Ticket::query()->update(['holder_email' => 'someone.real@example.com']);

    $this->artisan('e2e:purge', ['--force' => true])->assertSuccessful();

    expect(DB::table('tickets')->count())->toBe(0);
});

it('reports that there is nothing to purge on a clean database', function () {
    $this->artisan('e2e:purge', ['--force' => true])
        ->expectsOutputToContain('Nothing to purge.')
        ->assertSuccessful();
});

it('sweeps stale fixtures when the seeder runs', function () {
    seedFixture();

    // Older than the seeder's six-hour cut, so the next seed should clear it.
    $this->travel(7)->hours();

    seedFixture();

    // One fixture left: the new one. The stale one is gone.
    expect(DB::table('venues')->where('name', 'like', 'e2e-%')->count())->toBe(1);
});

it('does not sweep a fixture from the current run when seeding again', function () {
    seedFixture();
    seedFixture();

    // Both are minutes old, so neither is in range — parallel workers stay safe.
    expect(DB::table('venues')->where('name', 'like', 'e2e-%')->count())->toBe(2);
});
