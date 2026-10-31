<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Support\Facades\Http;

/**
 * Google Programmable Search JSON API (the engine set to "search the entire
 * web"). Free: 100 queries a day, then billed only if billing is on — the
 * default cap stays at 80. Queries, most valuable first: the band's own
 * keywords (mentions), then per country ska news, then per country leads —
 * concerts, festivals, and ska accounts on Instagram, whose public profiles
 * reach the inbox only as URLs Google returned; the page is never fetched.
 */
final class GoogleCseSource implements Source
{
    private const URL = 'https://www.googleapis.com/customsearch/v1';

    /** Hosts whose result is a profile to reach, not an article. */
    private const PROFILE_HOSTS = ['instagram.com', 'facebook.com', 'bandcamp.com', 'soundcloud.com', 'tiktok.com'];

    public function key(): string
    {
        return 'google_cse';
    }

    public function enabled(array $settings): bool
    {
        return $settings['keywords'] !== [] || $settings['countries'] !== [];
    }

    public function queries(array $settings): iterable
    {
        foreach ($settings['keywords'] as $keyword) {
            yield new Query('"' . $keyword . '"', null, 'mention');
        }

        $countries = array_values(array_filter(
            array_map(fn ($code) => [$code, config("countries.{$code}")], $settings['countries']),
            fn ($pair) => is_array($pair[1]),
        ));

        foreach ($countries as [$code, $c]) {
            yield new Query("ska news {$c['name']}", $code, 'news', ['gl' => $c['gl'], 'hl' => $c['hl']]);
        }
        foreach ($countries as [$code, $c]) {
            $params = ['gl' => $c['gl'], 'hl' => $c['hl']];
            yield new Query("ska concert {$c['name']}", $code, 'lead', $params);
            yield new Query("ska festival {$c['name']}", $code, 'lead', $params);
            foreach (array_slice($settings['cities_by_country'][$code] ?? [], 0, 3) as $city) {
                yield new Query("site:instagram.com ska {$city}", $code, 'lead', $params);
            }
        }
    }

    public function fetch(Query $query): array
    {
        // The key goes in a header, never the URL: a URL is what an error
        // message quotes, and that message is logged and shown to admins.
        $response = Http::withHeaders(['X-goog-api-key' => (string) config('services.google.api_key')])
            ->timeout(15)
            ->get(self::URL, array_filter([
                'cx'  => config('services.google.cse_id'),
                'q'   => $query->text,
                'num' => 10,
                'gl'  => $query->params['gl'] ?? null,
                'hl'  => $query->params['hl'] ?? null,
            ]));

        if ($response->status() === 429 || ($response->status() === 403 && str_contains($response->body(), 'Limit'))) {
            throw new SourceCapped('Google Programmable Search quota reached.');
        }
        $response->throw();

        $out = [];
        foreach ($response->json('items') ?? [] as $item) {
            $url = (string) ($item['link'] ?? '');
            if ($url === '') {
                continue;
            }
            $isProfile = $this->isProfile($url);
            $out[] = new Finding(
                kind: $isProfile ? 'lead' : ($query->kind ?? 'news'),
                externalKey: sha1(self::normaliseUrl($url)),
                url: $url,
                title: (string) ($item['title'] ?? $url),
                snippet: (string) ($item['snippet'] ?? ''),
                country: $query->country,
                leadType: $isProfile ? 'profile' : null, // the rest is triage's call
                payload: ['host' => $item['displayLink'] ?? parse_url($url, PHP_URL_HOST), 'query' => $query->text],
            );
        }

        return $out;
    }

    /** host + path, lowercased, no scheme, www, query string or trailing slash — the same page found twice is one finding. */
    public static function normaliseUrl(string $url): string
    {
        $host = preg_replace('/^www\./', '', strtolower((string) parse_url($url, PHP_URL_HOST)));
        $path = rtrim((string) parse_url($url, PHP_URL_PATH), '/');

        // The query string is part of what a page is (watch?v=, news.php?id=),
        // so it stays — sorted, and without the tracking parameters that make
        // one page look like many.
        parse_str((string) parse_url($url, PHP_URL_QUERY), $params);
        $params = array_filter(
            $params,
            fn ($k) => !preg_match('/^(utm_|fbclid$|gclid$|igshid$|mc_|ref$)/i', (string) $k),
            ARRAY_FILTER_USE_KEY,
        );
        ksort($params);
        $query = http_build_query($params);

        return $host . $path . ($query === '' ? '' : '?' . $query);
    }

    private function isProfile(string $url): bool
    {
        $host = preg_replace('/^www\./', '', strtolower((string) parse_url($url, PHP_URL_HOST)));

        return in_array($host, self::PROFILE_HOSTS, true);
    }
}
