<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Support\Carbon;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

/**
 * Where bands like ours played: the last two pages of each sibling band's
 * setlists on setlist.fm, one venue lead per venue they played in the last
 * two years. A venue the band already knows still arrives — telling the two
 * apart is triage's job (slice 3).
 */
final class SetlistFmSource implements Source
{
    private const BASE = 'https://api.setlist.fm/rest/1.0';
    private const PAGES = 2;
    private const YEARS = 2;
    /** The standard key allows about two requests a second. */
    private const PACE_MS = 600;

    /**
     * Venues already handed back in this run. Pages come newest first and
     * page 1 before page 2, so the first sighting is the newest gig; a later
     * page or another band's older gig there must not overwrite it.
     *
     * @var array<string, true>
     */
    private array $seen = [];

    public function key(): string
    {
        return 'setlistfm';
    }

    public function enabled(array $settings): bool
    {
        return ($settings['sibling_bands'] ?? []) !== [];
    }

    public function queries(array $settings): iterable
    {
        $this->seen = []; // a new run
        foreach ($settings['sibling_bands'] ?? [] as $band) {
            for ($page = 1; $page <= self::PAGES; $page++) {
                yield new Query($band['name'], null, 'lead', ['mbid' => $band['mbid'], 'page' => $page]);
            }
        }
    }

    public function fetch(Query $query): array
    {
        $response = $this->request($query);
        if ($response->status() === 429) {
            Sleep::for(1)->second(); // the per-second limit, most likely — one retry
            $response = $this->request($query);
        }
        if ($response->status() === 429) {
            throw new SourceCapped('setlist.fm rate limit reached.');
        }
        if ($response->status() === 404) {
            return []; // past the last page
        }
        $response->throw();

        $since = Carbon::now()->subYears(self::YEARS)->startOfDay();
        $out   = [];
        foreach ($response->json('setlist') ?? [] as $set) {
            $venue = $set['venue'] ?? [];
            $id    = $venue['id'] ?? null;
            $date  = self::date($set['eventDate'] ?? null);
            if (!is_string($id) || isset($out[$id]) || isset($this->seen[$id]) || $date === null || $date->lt($since)) {
                continue; // newest first, so the first sighting of a venue is its last gig
            }
            $this->seen[$id] = true;
            $city    = $venue['city']['name'] ?? null;
            $band    = $set['artist']['name'] ?? $query->text;
            $out[$id] = new Finding(
                kind: 'lead',
                externalKey: $id,
                url: (string) ($venue['url'] ?? $set['url'] ?? 'https://www.setlist.fm'),
                title: trim(($venue['name'] ?? $id) . ($city ? ", {$city}" : '')),
                snippet: "{$band} played here on {$date->toDateString()}.",
                country: is_string($venue['city']['country']['code'] ?? null) ? $venue['city']['country']['code'] : null,
                leadType: 'venue',
                payload: ['city' => $city, 'lastPlayed' => $date->toDateString(), 'bandName' => $band],
            );
        }

        return array_values($out);
    }

    private function request(Query $query): Response
    {
        Sleep::for(self::PACE_MS)->milliseconds();
        $mbid = rawurlencode((string) $query->params['mbid']);

        return Http::timeout(15)
            ->withHeaders(['x-api-key' => (string) config('services.setlistfm.api_key'), 'Accept' => 'application/json'])
            ->get(self::BASE . "/artist/{$mbid}/setlists", ['p' => $query->params['page']]);
    }

    /** setlist.fm dates are dd-MM-yyyy. */
    private static function date(mixed $value): ?Carbon
    {
        if (!is_string($value) || !preg_match('/^\d{2}-\d{2}-\d{4}$/', $value)) {
            return null;
        }

        return Carbon::createFromFormat('d-m-Y', $value)->startOfDay();
    }
}
