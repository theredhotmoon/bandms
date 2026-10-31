<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Reddit's ska, reggae and punk subreddits, searched for the band's phrases
 * over the last week. An app-only token (client credentials of a "script"
 * app) is fetched once per run; Reddit asks for a User-Agent naming the app
 * and its owner. Off by default: Reddit blocks many datacenter IPs.
 */
final class RedditSource implements Source
{
    private const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
    private const SEARCH_URL = 'https://oauth.reddit.com/r/ska+reggae+punk/search';

    // The registry is a singleton in a long-running queue worker, so the
    // token is kept only until shortly before Reddit says it expires.
    private ?string $token = null;
    private int $tokenExpires = 0;

    public function key(): string
    {
        return 'reddit';
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
    }

    public function fetch(Query $query): array
    {
        $response = Http::timeout(15)
            ->withHeaders(['User-Agent' => $this->userAgent()])
            ->withToken($this->token())
            ->get(self::SEARCH_URL, [
                'q'           => $query->text,
                'restrict_sr' => 1,
                'sort'        => 'new',
                't'           => 'week',
                'limit'       => 25,
            ]);

        if ($response->status() === 429) {
            throw new SourceCapped('Reddit rate limit reached.');
        }
        if ($response->status() === 403) {
            throw new RuntimeException('Reddit refused the request (403). Reddit blocks many server IPs; check the app is a "script" app and that this server can reach Reddit.');
        }
        $response->throw();

        $out = [];
        foreach ($response->json('data.children') ?? [] as $child) {
            $post = $child['data'] ?? [];
            if (!is_string($post['id'] ?? null) || !is_string($post['permalink'] ?? null)) {
                continue;
            }
            $out[] = new Finding(
                kind: 'mention',
                externalKey: $post['id'],
                url: 'https://www.reddit.com' . $post['permalink'],
                title: (string) ($post['title'] ?? $post['id']),
                snippet: mb_substr((string) ($post['selftext'] ?? ''), 0, 500),
                country: null,
                leadType: null,
                payload: ['subreddit' => $post['subreddit'] ?? null, 'author' => $post['author'] ?? null],
            );
        }

        return $out;
    }

    private function token(): string
    {
        if ($this->token !== null && time() < $this->tokenExpires) {
            return $this->token;
        }

        $response = Http::timeout(15)
            ->withHeaders(['User-Agent' => $this->userAgent()])
            ->withBasicAuth((string) config('services.reddit.client_id'), (string) config('services.reddit.client_secret'))
            ->asForm()
            ->post(self::TOKEN_URL, ['grant_type' => 'client_credentials']);

        if ($response->status() === 401) {
            throw new RuntimeException('Reddit rejected the app credentials — check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.');
        }
        $response->throw();

        $token = $response->json('access_token');
        if (!is_string($token) || $token === '') {
            throw new RuntimeException('Reddit returned no access token.');
        }

        $this->tokenExpires = time() + max(60, (int) ($response->json('expires_in') ?? 3600) - 60);

        return $this->token = $token;
    }

    private function userAgent(): string
    {
        $name = (string) config('services.reddit.username', '');

        return 'web:bandms:v1' . ($name !== '' ? " (by /u/{$name})" : '');
    }
}
