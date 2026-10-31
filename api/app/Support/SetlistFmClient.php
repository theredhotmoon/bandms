<?php

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * The one setlist.fm client: base URL, key header and the two calls this app
 * makes. The setlists page (SetlistFmController) and the crawler
 * (SetlistFmSource) both go through it, so an API or auth change is one edit.
 * It returns the raw response — each caller decides what a 404 or 429 means.
 */
final class SetlistFmClient
{
    private const BASE = 'https://api.setlist.fm/rest/1.0';

    public function hasKey(): bool
    {
        return $this->key() !== '';
    }

    public function searchArtists(string $name, int $timeout = 10): Response
    {
        return $this->request($timeout)->get(self::BASE . '/search/artists', [
            'artistName' => $name,
            'p'          => 1,
            'sort'       => 'relevance',
        ]);
    }

    public function artistSetlists(string $mbid, int $page, int $timeout = 10): Response
    {
        return $this->request($timeout)->get(self::BASE . '/artist/' . rawurlencode($mbid) . '/setlists', ['p' => $page]);
    }

    private function request(int $timeout): \Illuminate\Http\Client\PendingRequest
    {
        return Http::timeout($timeout)->withHeaders([
            'x-api-key' => $this->key(),
            'Accept'    => 'application/json',
        ]);
    }

    private function key(): string
    {
        return (string) config('services.setlistfm.api_key', '');
    }
}
