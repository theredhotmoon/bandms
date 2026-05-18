<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SetlistFmController extends Controller
{
    private const BASE = 'https://api.setlist.fm/rest/1.0';

    private function apiKey(): string
    {
        return config('services.setlistfm.api_key', '');
    }

    private function headers(): array
    {
        return [
            'x-api-key' => $this->apiKey(),
            'Accept'    => 'application/json',
        ];
    }

    public function searchArtist(Request $request): JsonResponse
    {
        $request->validate(['q' => ['required', 'string', 'max:100']]);

        if (!$this->apiKey()) {
            return response()->json(['error' => 'setlist.fm API key not configured'], 503);
        }

        $res = Http::timeout(10)
            ->withHeaders($this->headers())
            ->get(self::BASE . '/search/artists', [
                'artistName' => $request->q,
                'p'          => 1,
                'sort'       => 'relevance',
            ]);

        if (!$res->successful()) {
            return response()->json(['error' => 'setlist.fm API error'], 502);
        }

        $artists = collect($res->json('artist', []))->map(fn ($a) => [
            'mbid' => $a['mbid'] ?? null,
            'name' => $a['name'] ?? '',
        ])->values();

        return response()->json(['data' => $artists]);
    }

    public function artistSetlists(Request $request, string $mbid): JsonResponse
    {
        if (!$this->apiKey()) {
            return response()->json(['error' => 'setlist.fm API key not configured'], 503);
        }

        $page = max(1, (int) $request->get('p', 1));

        $res = Http::timeout(10)
            ->withHeaders($this->headers())
            ->get(self::BASE . "/artist/{$mbid}/setlists", ['p' => $page]);

        if (!$res->successful()) {
            return response()->json(['error' => 'setlist.fm API error'], 502);
        }

        $raw = $res->json('setlist', []);

        $setlists = collect($raw)->map(fn ($s) => [
            'id'         => $s['id'] ?? null,
            'event_date' => $s['eventDate'] ?? null,
            'venue'      => ($s['venue']['name'] ?? '') . (isset($s['venue']['city']['name']) ? ', ' . $s['venue']['city']['name'] : ''),
            'song_count' => collect($s['sets']['set'] ?? [])->flatMap(fn ($set) => $set['song'] ?? [])->count(),
            'songs'      => collect($s['sets']['set'] ?? [])->flatMap(function ($set) {
                $encore = ($set['encore'] ?? 0) == 1;
                return collect($set['song'] ?? [])->map(fn ($song) => [
                    'title'    => $song['name'] ?? '',
                    'is_encore' => $encore,
                ]);
            })->values(),
        ])->filter(fn ($s) => $s['song_count'] > 0)->values();

        return response()->json([
            'data'  => $setlists,
            'total' => $res->json('total', 0),
            'page'  => $page,
        ]);
    }
}
