<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Support\SafeUrl;
use Illuminate\Support\Carbon;
use RuntimeException;
use SimpleXMLElement;

/**
 * The ska news feeds the band listed: RSS 2.0 or Atom, items from the last
 * two weeks. Feed addresses are typed by a person, so they go through
 * SafeUrl — a feed on a private address fails the run instead of letting the
 * crawler read the server's own network.
 */
final class RssSource implements Source
{
    private const DAYS = 14;
    private const MAX_BYTES = 2_000_000;

    public function key(): string
    {
        return 'rss';
    }

    public function enabled(array $settings): bool
    {
        return ($settings['rss_feeds'] ?? []) !== [];
    }

    public function queries(array $settings): iterable
    {
        foreach ($settings['rss_feeds'] ?? [] as $url) {
            yield new Query($url, null, 'news');
        }
    }

    public function fetch(Query $query): array
    {
        $response = SafeUrl::get($query->text, 15, ['Accept' => 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'], self::MAX_BYTES);
        if ($response === null) {
            throw new RuntimeException("Feed {$query->text} is not a public http(s) address.");
        }
        $response->throw();

        // SafeUrl stopped the download at MAX_BYTES (and named the host).
        $body = $response->body();

        // LIBXML_NONET: never fetch anything the document points at.
        $xml = @simplexml_load_string($body, SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);
        if ($xml === false) {
            throw new RuntimeException("Feed {$query->text} is not valid RSS or Atom.");
        }

        $since = Carbon::now()->subDays(self::DAYS);
        $out   = [];
        foreach (self::items($xml) as $item) {
            if ($item['link'] === '' || ($item['date'] !== null && $item['date']->lt($since))) {
                continue;
            }
            $out[] = new Finding(
                kind: 'news',
                externalKey: sha1($item['id'] !== '' ? $item['id'] : $item['link']),
                url: $item['link'],
                title: $item['title'] !== '' ? $item['title'] : $item['link'],
                snippet: mb_substr(trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($item['summary'])))), 0, 500),
                country: null,
                leadType: null,
                payload: ['feed' => $query->text, 'published' => $item['date']?->toIso8601String()],
            );
        }

        return $out;
    }

    /** @return iterable<array{id: string, link: string, title: string, summary: string, date: ?Carbon}> */
    private static function items(SimpleXMLElement $xml): iterable
    {
        // RSS 1.0 (RDF) first: it has a channel too, but its items sit beside
        // the channel, in the RSS 1.0 namespace.
        if ($xml->getName() === 'RDF') {
            foreach ($xml->children('http://purl.org/rss/1.0/')->item as $item) {
                yield [
                    'id'      => trim((string) $item->link),
                    'link'    => trim((string) $item->link),
                    'title'   => trim((string) $item->title),
                    'summary' => (string) $item->description,
                    'date'    => self::date((string) $item->children('http://purl.org/dc/elements/1.1/')->date),
                ];
            }

            return;
        }

        if (isset($xml->channel)) {
            foreach ($xml->channel->item as $item) {
                yield [
                    'id'      => trim((string) $item->guid),
                    'link'    => trim((string) $item->link),
                    'title'   => trim((string) $item->title),
                    'summary' => (string) $item->description,
                    'date'    => self::date((string) $item->pubDate),
                ];
            }

            return;
        }

        foreach ($xml->entry as $entry) {
            $link = '';
            foreach ($entry->link as $l) {
                $rel = (string) $l['rel'];
                if ($rel === '' || $rel === 'alternate') {
                    $link = trim((string) $l['href']);
                    break;
                }
            }
            yield [
                'id'      => trim((string) $entry->id),
                'link'    => $link,
                'title'   => trim((string) $entry->title),
                'summary' => (string) ($entry->summary ?: $entry->content),
                'date'    => self::date((string) ($entry->updated ?: $entry->published)),
            ];
        }
    }

    private static function date(string $value): ?Carbon
    {
        if (trim($value) === '') {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
