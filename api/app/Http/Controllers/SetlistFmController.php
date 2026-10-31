<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\SetlistFmClient;

class SetlistFmController extends Controller
{
    public function __construct(private readonly SetlistFmClient $setlistFm) {}

    public function searchArtist(Request $request): JsonResponse
    {
        $request->validate(['q' => ['required', 'string', 'max:100']]);

        if (!$this->setlistFm->hasKey()) {
            return response()->json(['error' => 'setlist.fm API key not configured'], 503);
        }

        $res = $this->setlistFm->searchArtists((string) $request->q);

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
        if (!$this->setlistFm->hasKey()) {
            return response()->json(['error' => 'setlist.fm API key not configured'], 503);
        }

        $page = max(1, (int) $request->get('p', 1));

        $res = $this->setlistFm->artistSetlists($mbid, $page);

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
