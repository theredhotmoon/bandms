<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;

/**
 * Removes the fixtures `e2e:seed-ticket` leaves behind.
 *
 * That command only ever inserts — deliberately, so a stray run adds
 * recognisable junk rather than destroying anything — and nothing ever removed
 * what it added. One venue, concert, ticket type, price tier, fan account,
 * order and ticket per seed, on every suite run, for months: the dev database
 * reached 133 "Testville" venues against a single real one, and the public
 * concerts page listed all of them.
 *
 * Deletion order is not arbitrary. `concerts.venue_id` cascades from `venues`,
 * so dropping a venue takes its concert, ticket types and price tiers with it —
 * but `tickets` and `order_items` reference those with ON DELETE SET NULL, so
 * removing venues first would silently orphan 230 tickets and 133 orders rather
 * than deleting them. Tickets go first, then orders (which cascade their
 * items), then fan accounts, and venues last.
 */
class PurgeE2eFixtures extends Command
{
    use ConfirmableTrait;

    protected $signature = 'e2e:purge
                            {--older-than=0 : Only remove fixtures created more than this many hours ago}
                            {--dry-run : Report what would be deleted without deleting it}
                            {--force : Skip the production confirmation}';

    protected $description = 'Delete the venues, concerts, orders and tickets left behind by e2e:seed-ticket';

    public function handle(): int
    {
        if (! $this->option('dry-run') && ! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $hours = max(0, (int) $this->option('older-than'));
        $dryRun = (bool) $this->option('dry-run');

        // Null means "no age filter", and that is not the same as a cutoff of
        // now(). Timestamps have second precision, so `created_at < now()`
        // excludes anything created in the current second — which is every row
        // a test just seeded, and occasionally a row in production too. The
        // default of 0 has to mean *everything*, so it gets no clause at all.
        $cutoff = $hours > 0 ? now()->subHours($hours) : null;

        if ($cutoff !== null) {
            $this->line("Only fixtures created before {$cutoff->toDateTimeString()} ({$hours}h ago).");
        }

        // Tickets first, and matched two ways. holder_email covers the common
        // case, but a ticket transferred to a real address during a spec would
        // no longer carry the e2e prefix — the order it was bought on still
        // does. Matching only on the email would leave those behind forever.
        $ticketIds = DB::table('tickets')
            ->leftJoin('order_items', 'order_items.id', '=', 'tickets.order_item_id')
            ->leftJoin('orders', 'orders.id', '=', 'order_items.order_id')
            ->when($cutoff, fn ($q) => $q->where('tickets.created_at', '<', $cutoff))
            ->where(function ($q) {
                $q->where('tickets.holder_email', 'like', 'e2e-%')
                    ->orWhere('orders.email', 'like', 'e2e-%');
            })
            ->pluck('tickets.id');

        $counts = [
            'tickets' => $ticketIds->count(),
            'orders' => self::stale(DB::table('orders')->where('email', 'like', 'e2e-%'), $cutoff)->count(),
            'fan accounts' => self::stale(DB::table('fan_accounts')->where('email', 'like', 'e2e-%'), $cutoff)->count(),
            'venues' => self::stale(DB::table('venues')->where('name', 'like', 'e2e-%'), $cutoff)->count(),
        ];

        // Reported separately because they are removed by the venue cascade, not
        // by a delete of their own — worth seeing in the total.
        $counts['concerts (via venue cascade)'] = DB::table('concerts')
            ->join('venues', 'venues.id', '=', 'concerts.venue_id')
            ->where('venues.name', 'like', 'e2e-%')
            ->when($cutoff, fn ($q) => $q->where('venues.created_at', '<', $cutoff))
            ->count();

        if (array_sum($counts) === 0) {
            $this->info('Nothing to purge.');

            return self::SUCCESS;
        }

        if (! $dryRun) {
            DB::transaction(function () use ($ticketIds, $cutoff) {
                DB::table('tickets')->whereIn('id', $ticketIds)->delete();

                // order_items cascade from orders; no separate delete needed.
                self::stale(DB::table('orders')->where('email', 'like', 'e2e-%'), $cutoff)->delete();
                self::stale(DB::table('fan_accounts')->where('email', 'like', 'e2e-%'), $cutoff)->delete();

                // Cascades to concerts → concert_ticket_types → price tiers.
                self::stale(DB::table('venues')->where('name', 'like', 'e2e-%'), $cutoff)->delete();

                // A ticket type created directly by an admin spec has no e2e
                // venue above it to cascade from, so sweep those by name too.
                self::stale(DB::table('concert_ticket_types')->where('name', 'like', 'e2e-%'), $cutoff)->delete();
            });
        }

        $verb = $dryRun ? 'would delete' : 'deleted';
        foreach ($counts as $label => $n) {
            if ($n > 0) {
                $this->line(sprintf('  %-32s %s %d', $label, $verb, $n));
            }
        }

        $this->info(sprintf('%s %d row(s).', $dryRun ? 'Would delete' : 'Purged', array_sum($counts)));

        return self::SUCCESS;
    }

    /** Applies the age filter, or no filter at all when none was asked for. */
    private static function stale($query, ?\Illuminate\Support\Carbon $cutoff)
    {
        return $cutoff === null ? $query : $query->where('created_at', '<', $cutoff);
    }
}
