<?php

namespace App\Assistant\Crawler;

/**
 * Which site, channel or account a finding came from — what "Wrong → block
 * the whole site" blocks. A plain website is its host (lowercase, no www, as
 * in GoogleCseSource::normaliseUrl), and a block on a host covers its
 * subdomains. On a platform a host would block every account on it (one bad
 * Facebook post would block Facebook), so there the key is the account:
 * `instagram.com/klubstudio`, `reddit.com/r/ska`, a YouTube channel. Where no
 * account can be read off the URL (a post permalink, a Maps link, a
 * setlist.fm page, the apex of a hosting service) there is nothing to block
 * and `for()` returns null.
 */
final class SiteKey
{
    /**
     * Hosts where the account, not the host, is the site. Any subdomain
     * counts as the platform (old.reddit.com, pl-pl.facebook.com,
     * music.youtube.com), so it cannot become a host-wide block.
     */
    private const PLATFORMS = [
        'instagram.com', 'facebook.com', 'tiktok.com', 'soundcloud.com', 'x.com', 'twitter.com',
        'youtube.com', 'reddit.com', 'threads.net', 'linktr.ee', 'medium.com',
    ];

    /**
     * Hosting services whose tenants live on subdomains: `artist.bandcamp.com`
     * is a site of its own, but the apex is everyone's, and a block on it
     * would cover every tenant through the subdomain rule.
     */
    private const SHARED_HOSTS = [
        'bandcamp.com', 'blogspot.com', 'wordpress.com', 'substack.com', 'tumblr.com',
        'wixsite.com', 'weebly.com', 'github.io', 'webflow.io', 'carrd.co', 'bandsintown.com',
    ];

    /** Hosts that only ever point at someone else's record: never blockable. */
    private const NEVER = ['google.com', 'maps.google.com', 'goo.gl', 'maps.app.goo.gl', 'setlist.fm', 'youtu.be'];

    /** Sources whose findings come from the band's own accounts — never theirs to block. */
    private const OWN_SOURCES = ['meta_own'];

    /** First path segments on a platform that name a post or a page type, not an account. */
    private const NOT_ACCOUNTS = [
        'p', 'reel', 'reels', 'stories', 'explore', 'watch', 'events', 'groups', 'share', 'sharer',
        'sharer.php', 'photo', 'photo.php', 'photos', 'story.php', 'permalink.php', 'hashtag', 'tv',
        'i', 'search', 'tag', 'tags', 'video', 'videos', 'shorts', 'results', 'playlist', 'pages',
        'profile.php', 'home', 'login', 'discover', 'music', 'sets', 'comments', 'gallery', 'media',
        'pg', 'intent', 'l.php', 'notes', 'marketplace', 'gaming', 'watch.php', 'feed', 'about',
        'hashtags', 'topics', 'status', 'settings', 'privacy', 'help', 'legal', 'policies',
    ];

    /**
     * @param  array<string, mixed>  $payload  the finding's payload (YouTube carries its channel there)
     * @return array{key: string, label: string, host: string}|null
     */
    public static function for(string $url, array $payload = [], ?string $source = null): ?array
    {
        if ($source !== null && in_array($source, self::OWN_SOURCES, true)) {
            return null;
        }

        $host = (string) preg_replace('/^www\./', '', strtolower((string) parse_url($url, PHP_URL_HOST)));
        if ($host === '' || in_array($host, self::NEVER, true) || in_array($host, self::SHARED_HOSTS, true)) {
            return null;
        }

        $platform = self::platformOf($host);
        if ($platform === null) {
            return ['key' => $host, 'label' => $host, 'host' => $host];
        }

        // Channel ids are case-sensitive: kept as sent, everything else lowercased.
        if ($platform === 'youtube.com' && is_string($payload['channelId'] ?? null) && $payload['channelId'] !== '') {
            $title = is_string($payload['channelTitle'] ?? null) && $payload['channelTitle'] !== ''
                ? $payload['channelTitle'] : $payload['channelId'];

            return ['key' => 'youtube.com/channel/' . $payload['channelId'], 'label' => "YouTube: {$title}", 'host' => $platform];
        }

        $account = self::account($platform, array_values(array_filter(
            explode('/', (string) parse_url($url, PHP_URL_PATH)),
            fn ($s) => $s !== '',
        )));

        return $account === null ? null : ['key' => "{$platform}/{$account}", 'label' => "{$platform}/{$account}", 'host' => $platform];
    }

    /**
     * Whether a site falls under any of the blocked keys: the same key, or —
     * for a website — a blocked parent host (`news.example.com` under
     * `example.com`).
     *
     * @param  array{key: string, host: string}|null  $site
     * @param  list<string>  $blocked
     */
    public static function isBlocked(?array $site, array $blocked): bool
    {
        if ($site === null || $blocked === []) {
            return false;
        }
        if (in_array($site['key'], $blocked, true)) {
            return true;
        }
        if (str_contains($site['key'], '/')) {
            return false; // an account is blocked only by its own key
        }
        foreach ($blocked as $b) {
            if (!str_contains($b, '/') && str_ends_with($site['host'], ".{$b}")) {
                return true;
            }
        }

        return false;
    }

    private static function platformOf(string $host): ?string
    {
        foreach (self::PLATFORMS as $p) {
            if ($host === $p || str_ends_with($host, ".{$p}")) {
                return $p;
            }
        }

        return null;
    }

    /** @param list<string> $segments the path as sent */
    private static function account(string $platform, array $segments): ?string
    {
        $first = strtolower($segments[0] ?? '');
        $second = $segments[1] ?? null;
        if ($first === '') {
            return null;
        }

        // Two-part handles: reddit.com/r/ska, youtube.com/channel/UC…
        $twoPart = match ($platform) {
            'reddit.com'  => ['r', 'u', 'user'],
            'youtube.com' => ['channel', 'c', 'user'],
            default       => [],
        };
        if (in_array($first, $twoPart, true)) {
            if ($second === null) {
                return null;
            }

            return $first . '/' . ($first === 'channel' ? $second : strtolower($second));
        }
        // facebook.com/people/<name>/<id>: the id is the page, the name is not unique.
        if ($platform === 'facebook.com' && $first === 'people') {
            return isset($segments[2]) && ctype_digit($segments[2]) ? "people/{$segments[2]}" : null;
        }
        if ($platform === 'reddit.com' || in_array($first, self::NOT_ACCOUNTS, true)) {
            return null;
        }
        if (($platform === 'youtube.com' || $platform === 'medium.com') && !str_starts_with($first, '@')) {
            return null; // anything else there is a page, not a channel or a writer
        }

        return $first;
    }
}
