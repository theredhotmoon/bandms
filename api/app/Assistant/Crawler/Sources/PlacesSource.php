<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Support\Facades\Http;

/**
 * Google Places (New) Text Search: live-music venues and ska bars in each
 * city the band listed. Billed per request beyond the monthly free credit,
 * so it carries a month cap as well as a day cap; the field mask asks only
 * for the Essentials-tier fields a lead needs.
 */
final class PlacesSource implements Source
{
    private const URL = 'https://places.googleapis.com/v1/places:searchText';
    private const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.websiteUri';

    public function key(): string
    {
        return 'places';
    }

    public function enabled(array $settings): bool
    {
        return array_filter($settings['cities_by_country'] ?? []) !== [];
    }

    public function queries(array $settings): iterable
    {
        foreach ($settings['countries'] as $code) {
            foreach ($settings['cities_by_country'][$code] ?? [] as $city) {
                yield new Query("live music venue in {$city}", $code, 'lead');
                yield new Query("ska bar {$city}", $code, 'lead');
            }
        }
    }

    public function fetch(Query $query): array
    {
        $country  = $query->country ? config("countries.{$query->country}") : null;
        $response = Http::timeout(15)
            ->withHeaders([
                'X-Goog-Api-Key'   => (string) config('services.google.api_key'),
                'X-Goog-FieldMask' => self::FIELDS,
            ])
            ->post(self::URL, array_filter([
                'textQuery'    => $query->text,
                'pageSize'     => 20,
                'languageCode' => $country['hl'] ?? null,
                'regionCode'   => $query->country,
            ]));

        if ($response->status() === 429 || $response->json('error.status') === 'RESOURCE_EXHAUSTED') {
            throw new SourceCapped('Google Places quota reached.');
        }
        $response->throw();

        $out = [];
        foreach ($response->json('places') ?? [] as $place) {
            $id = $place['id'] ?? null;
            if (!is_string($id)) {
                continue;
            }
            $website = is_string($place['websiteUri'] ?? null) ? $place['websiteUri'] : null;
            $address = (string) ($place['formattedAddress'] ?? '');
            $out[]   = new Finding(
                kind: 'lead',
                externalKey: $id,
                url: $website ?? 'https://www.google.com/maps/place/?q=place_id:' . rawurlencode($id),
                title: (string) ($place['displayName']['text'] ?? $id),
                snippet: $address,
                country: $query->country,
                leadType: 'venue',
                payload: ['address' => $address, 'website' => $website, 'types' => $place['types'] ?? []],
            );
        }

        return $out;
    }
}
