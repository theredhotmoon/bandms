<?php

namespace App\Assistant\Crawler\Sources;

use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Posts that tag the band: on its Facebook Page (`/{page}/tagged`) and on the
 * linked Instagram business account (`/{ig-user}/tags`), read with the Page
 * access token. Only the band's own accounts — the Graph API offers no
 * search across other people's posts. The token goes in the Authorization
 * header, never the URL, so a logged error cannot carry it.
 */
final class MetaOwnSource implements Source
{
    private const GRAPH = 'https://graph.facebook.com/v21.0';

    public function key(): string
    {
        return 'meta_own';
    }

    public function enabled(array $settings): bool
    {
        return true;
    }

    public function queries(array $settings): iterable
    {
        yield new Query('facebook', null, 'mention', ['edge' => 'facebook']);
        if ((string) config('services.facebook.instagram_user_id', '') !== '') {
            yield new Query('instagram', null, 'mention', ['edge' => 'instagram']);
        }
    }

    public function fetch(Query $query): array
    {
        return $query->params['edge'] === 'instagram' ? $this->instagram() : $this->facebook();
    }

    /** @return Finding[] */
    private function facebook(): array
    {
        $page = rawurlencode((string) config('services.facebook.page_id'));
        $data = $this->get("/{$page}/tagged", 'id,message,permalink_url,from,created_time');

        $out = [];
        foreach ($data as $post) {
            if (!is_string($post['id'] ?? null) || !is_string($post['permalink_url'] ?? null)) {
                continue;
            }
            $from  = (string) ($post['from']['name'] ?? 'Someone');
            $out[] = new Finding(
                kind: 'mention',
                externalKey: 'fb:' . $post['id'],
                url: $post['permalink_url'],
                title: "{$from} tagged the band on Facebook",
                snippet: mb_substr((string) ($post['message'] ?? ''), 0, 500),
                country: null,
                leadType: null,
                payload: ['from' => $from, 'created' => $post['created_time'] ?? null],
            );
        }

        return $out;
    }

    /** @return Finding[] */
    private function instagram(): array
    {
        $user = rawurlencode((string) config('services.facebook.instagram_user_id'));
        $data = $this->get("/{$user}/tags", 'id,caption,permalink,username,timestamp');

        $out = [];
        foreach ($data as $media) {
            if (!is_string($media['id'] ?? null) || !is_string($media['permalink'] ?? null)) {
                continue;
            }
            $who   = (string) ($media['username'] ?? 'Someone');
            $out[] = new Finding(
                kind: 'mention',
                externalKey: 'ig:' . $media['id'],
                url: $media['permalink'],
                title: "@{$who} tagged the band on Instagram",
                snippet: mb_substr((string) ($media['caption'] ?? ''), 0, 500),
                country: null,
                leadType: null,
                payload: ['username' => $who, 'created' => $media['timestamp'] ?? null],
            );
        }

        return $out;
    }

    /** @return array<int, array<string, mixed>> */
    private function get(string $path, string $fields): array
    {
        $response = Http::timeout(15)
            ->withToken((string) config('services.facebook.page_access_token'))
            ->get(self::GRAPH . $path, ['fields' => $fields, 'limit' => 50]);

        $this->guard($response);

        return $response->json('data') ?? [];
    }

    private function guard(Response $response): void
    {
        if ($response->successful()) {
            return;
        }
        $code = (int) $response->json('error.code');
        if ($code === 190) {
            throw new RuntimeException('Facebook Page token expired — mint a new Page access token and put it in FACEBOOK_PAGE_ACCESS_TOKEN.');
        }
        if (in_array($code, [4, 17, 32, 613], true)) {
            throw new SourceCapped('Facebook Graph API rate limit reached.');
        }
        throw new RuntimeException('Facebook Graph API error ' . $response->status() . ': ' . mb_substr((string) $response->json('error.message'), 0, 200));
    }
}
