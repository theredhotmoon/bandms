<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Support\Facades\Http;

/**
 * YouTube Data API v3 `search.list` — 100 quota units a call, from the same
 * 10 000-unit daily quota the view-count sync uses, so the default cap is 20
 * searches. The band's keywords find mentions (fan videos, covers, live
 * clips); "ska live" per country finds bands and venues whose channel is the
 * lead.
 */
final class YouTubeSource implements Source
{
    private const URL = 'https://www.googleapis.com/youtube/v3/search';

    public function key(): string
    {
        return 'youtube';
    }

    public function enabled(array $settings): bool
    {
        return true;
    }

    public function queries(array $settings): iterable
    {
        foreach ($settings['keywords'] as $keyword) {
            yield new Query($keyword, null, 'mention');
        }
        foreach ($settings['countries'] as $code) {
            if (config("countries.{$code}")) {
                yield new Query('ska live', $code, 'lead', ['regionCode' => $code]);
            }
        }
    }

    public function fetch(Query $query): array
    {
        // The key goes in a header, never the URL: a URL is what an error
        // message quotes, and that message is logged and shown to admins.
        $response = Http::withHeaders(['X-goog-api-key' => (string) config('services.youtube.api_key')])
            ->timeout(15)
            ->get(self::URL, array_filter([
                'part'       => 'snippet',
                'type'       => 'video',
                'q'          => $query->text,
                'order'      => 'date',
                'maxResults' => 25,
                'regionCode' => $query->params['regionCode'] ?? null,
            ]));

        if ($response->status() === 403 && str_contains($response->body(), 'quotaExceeded')) {
            throw new SourceCapped('YouTube Data API quota reached.');
        }
        $response->throw();

        $out = [];
        foreach ($response->json('items') ?? [] as $item) {
            $videoId = $item['id']['videoId'] ?? null;
            if (!is_string($videoId)) {
                continue;
            }
            $s = $item['snippet'] ?? [];
            $out[] = new Finding(
                kind: $query->kind ?? 'mention',
                externalKey: $videoId,
                url: "https://www.youtube.com/watch?v={$videoId}",
                title: (string) ($s['title'] ?? $videoId),
                snippet: mb_substr((string) ($s['description'] ?? ''), 0, 500),
                country: $query->country,
                leadType: $query->kind === 'lead' ? 'band' : null,
                payload: ['channelId' => $s['channelId'] ?? null, 'channelTitle' => $s['channelTitle'] ?? null],
            );
        }

        return $out;
    }
}
