<?php

namespace App\Console\Commands;

use App\Models\Venue;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\Http;

/**
 * Backfills venues.latitude / venues.longitude from their address.
 *
 * The admin venue form already geocodes — Nominatim search plus click-to-place —
 * but only one venue at a time, and only when a human opens that form. Rows
 * imported, seeded, or created before anyone thought about the map therefore sit
 * at NULL forever, and a venue with no coordinates is silently dropped from the
 * public map: `ConcertsSection.astro` filters on `concertsWithCoords`, so the
 * whole map section disappears rather than showing a gap. This fills them in
 * bulk so the map has something to draw.
 *
 * Nominatim's usage policy caps this at one request per second and requires a
 * User-Agent identifying the application. Both are honoured below. It also asks
 * that you not bulk-geocode large datasets — a band's venue list is tens of
 * rows, which is the small-scale case the public endpoint is for. If this ever
 * grows to thousands, move to a paid geocoder rather than raising the rate.
 */
class GeocodeVenues extends Command
{
    use ConfirmableTrait;

    protected $signature = 'venues:geocode
                            {--dry-run : Show what would be written without touching the database}
                            {--all : Also re-geocode venues that already have coordinates}
                            {--limit= : Stop after this many venues}
                            {--force : Skip the production confirmation}';

    protected $description = 'Fill in missing venue coordinates from their address via OpenStreetMap Nominatim';

    private const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

    /** Nominatim's published rate limit: one request per second, absolute. */
    private const RATE_LIMIT_SECONDS = 1;

    public function handle(): int
    {
        if (! $this->option('dry-run') && ! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $query = Venue::query()
            ->when(! $this->option('all'), fn ($q) => $q->where(
                fn ($w) => $w->whereNull('latitude')->orWhereNull('longitude')
            ))
            ->orderBy('id');

        if ($limit = (int) $this->option('limit')) {
            $query->limit($limit);
        }

        $venues = $query->get();

        if ($venues->isEmpty()) {
            $this->info('Nothing to do — every venue already has coordinates.');

            return self::SUCCESS;
        }

        $this->line("Geocoding {$venues->count()} venue(s) via Nominatim…");
        if ($this->option('dry-run')) {
            $this->comment('Dry run — nothing will be written.');
        }

        // Venues cluster heavily by city, and this run's queries are identical
        // for every venue sharing an address. Memoising collapses those into one
        // network call: 130 rows across 2 distinct addresses costs 2 requests,
        // not 130. That matters at one request per second, and it is the
        // difference between a polite backfill and hammering a free service.
        $resolved = [];
        $rows = [];
        $written = $skipped = $missed = 0;

        foreach ($venues as $venue) {
            $address = $this->addressFor($venue);

            if ($address === null) {
                $rows[] = [$venue->id, $venue->name, '—', 'skipped — no address to search on'];
                $skipped++;
                continue;
            }

            if (! array_key_exists($address, $resolved)) {
                // Between requests, never after the last one: a backfill that
                // resolves a single address should not idle for a second on
                // its way out.
                if ($resolved !== []) {
                    sleep(self::RATE_LIMIT_SECONDS);
                }

                $resolved[$address] = $this->lookup($address);
            }

            $hit = $resolved[$address];

            if ($hit === null) {
                $rows[] = [$venue->id, $venue->name, $address, 'no match'];
                $missed++;
                continue;
            }

            if (! $this->option('dry-run')) {
                $venue->update(['latitude' => $hit['lat'], 'longitude' => $hit['lon']]);
            }

            $rows[] = [$venue->id, $venue->name, $address, sprintf('%.5f, %.5f', $hit['lat'], $hit['lon'])];
            $written++;
        }

        $this->newLine();
        $this->table(['ID', 'Venue', 'Searched for', 'Result'], $rows);
        $this->newLine();

        $verb = $this->option('dry-run') ? 'would be written' : 'written';
        $this->info("{$written} {$verb}, {$missed} without a match, {$skipped} skipped.");

        if ($missed > 0) {
            $this->comment('Venues without a match need a pin placed by hand in /admin/venues.');
        }

        return self::SUCCESS;
    }

    /**
     * The string handed to the geocoder, or null when there is nothing to go on.
     *
     * The venue name is deliberately left out. It helps for a landmark ("Tauron
     * Arena") and actively hurts for anything generic ("Klub Studio"), and a
     * wrong first result is worse than no result: it writes a plausible pin in
     * the wrong city that nobody will ever think to double-check. The address is
     * the part that identifies a place unambiguously, so that is what we send.
     */
    private function addressFor(Venue $venue): ?string
    {
        $parts = array_filter([
            trim(($venue->street ?? '') . ' ' . ($venue->street_number ?? '')),
            $venue->postcode,
            $venue->city,
        ], fn ($p) => filled($p));

        return $parts === [] ? null : implode(', ', $parts);
    }

    /**
     * One Nominatim lookup. Returns the top hit, or null.
     *
     * Nominatim orders by its own importance score, and we take the first —
     * which is why --dry-run exists. Review the table, then run it for real.
     * A failed request is treated as "no match" rather than aborting the run:
     * one flaky lookup should not cost the other hundred their coordinates.
     */
    private function lookup(string $address): ?array
    {
        try {
            $response = Http::timeout(15)
                // Required by Nominatim's usage policy — an anonymous client is
                // blocked outright, which would look exactly like "no match".
                ->withHeaders([
                    'User-Agent' => config('app.name', 'bandms') . ' venue geocoder (' . config('app.url') . ')',
                ])
                ->get(self::ENDPOINT, [
                    'q'      => $address,
                    'format' => 'json',
                    'limit'  => 1,
                ]);

            if (! $response->successful()) {
                $this->warn("  Nominatim returned {$response->status()} for \"{$address}\"");

                return null;
            }

            $hit = $response->json()[0] ?? null;

            if (! isset($hit['lat'], $hit['lon'])) {
                return null;
            }

            return ['lat' => (float) $hit['lat'], 'lon' => (float) $hit['lon']];
        } catch (\Throwable $e) {
            $this->warn("  Lookup failed for \"{$address}\": {$e->getMessage()}");

            return null;
        }
    }
}
