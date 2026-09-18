<?php

namespace App\Support;

/**
 * Maps a pasted URL to an embed provider and its id.
 *
 * Detection lives server-side, and the resolved provider is *stored* on the
 * block, so a later change to these rules cannot silently re-point existing
 * content. Extraction lives here too so the admin preview and the public
 * renderer cannot disagree about which video a block points at.
 *
 * Adding a provider is one entry in HOSTS plus one arm in embedId() (and
 * AUDIO if it is a fixed-height player) — mirrored by one arm each in
 * web/src/components/blocks/EmbedBlock.astro's SRC/SHAPE maps and
 * app/src/utils/postBlocks.ts.
 */
final class EmbedProvider
{
    public const PROVIDERS = ['youtube', 'vimeo', 'instagram', 'tiktok', 'facebook', 'spotify', 'soundcloud', 'apple_music', 'link'];

    /** Audio players are fixed-height frames, not 16:9 — the renderer needs to know. */
    public const AUDIO = ['spotify', 'soundcloud', 'apple_music'];

    /** Host suffix => provider. Checked longest-first is unnecessary; suffixes are disjoint. */
    private const HOSTS = [
        'youtube.com'      => 'youtube',
        'youtu.be'         => 'youtube',
        'vimeo.com'        => 'vimeo',
        'instagram.com'    => 'instagram',
        'tiktok.com'       => 'tiktok',
        'facebook.com'     => 'facebook',
        'fb.watch'         => 'facebook',
        'open.spotify.com' => 'spotify',
        'soundcloud.com'   => 'soundcloud',
        'music.apple.com'  => 'apple_music',
    ];

    public static function isAudio(string $provider): bool
    {
        return in_array($provider, self::AUDIO, true);
    }

    public static function detect(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return 'link';
        }

        $host = strtolower(preg_replace('/^www\./', '', $host));

        foreach (self::HOSTS as $suffix => $provider) {
            if ($host === $suffix || str_ends_with($host, '.' . $suffix)) {
                return $provider;
            }
        }

        return 'link';
    }

    /**
     * The provider-specific id, or null when the URL carries none.
     *
     * Null is meaningful: the renderer falls back to a plain link row rather
     * than emitting an iframe with a broken src. A Vimeo *channel* URL is the
     * everyday case — it is on vimeo.com but names no single video.
     */
    public static function embedId(string $url): ?string
    {
        return match (self::detect($url)) {
            'youtube'   => self::match('~(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/))([A-Za-z0-9_-]{11})~', $url),
            'vimeo'     => self::match('~vimeo\.com/(?:video/)?(\d+)~', $url),
            'instagram' => self::match('~instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)~', $url),
            'tiktok'    => self::match('~tiktok\.com/@[^/]+/video/(\d+)~', $url),
            // Facebook's player is plugins/video.php?href=<url>: the whole URL
            // is the id. Only URLs that name a single video qualify.
            'facebook'  => preg_match('~(?:facebook\.com/(?:[^/]+/videos/\d+|watch/?\?v=\d+|reel/\d+)|fb\.watch/[A-Za-z0-9_-]+)~', $url) === 1 ? $url : null,
            // Spotify's player is /embed/{type}/{id}; artists have no player.
            'spotify'   => preg_match('~open\.spotify\.com/(track|album|playlist|episode|show)/([A-Za-z0-9]+)~', $url, $m) === 1 ? "{$m[1]}/{$m[2]}" : null,
            // SoundCloud's player takes ?url=<page>; needs /{user}/{track-or-set}.
            'soundcloud' => preg_match('~soundcloud\.com/[^/?#]+/[^/?#]+~', $url) === 1 ? $url : null,
            // Apple Music: embed.music.apple.com + the same path (incl. ?i= for a song).
            'apple_music' => self::appleMusicPath($url),
            default     => null,
        };
    }

    private static function match(string $pattern, string $url): ?string
    {
        return preg_match($pattern, $url, $m) === 1 ? $m[1] : null;
    }

    private static function appleMusicPath(string $url): ?string
    {
        $path  = parse_url($url, PHP_URL_PATH) ?? '';
        $query = parse_url($url, PHP_URL_QUERY);

        if (preg_match('~^/[a-z]{2}/(?:album|song|playlist)/[^/]+/(?:pl\.)?[A-Za-z0-9.]+$~', $path) !== 1) {
            return null;
        }

        return $path . ($query ? "?{$query}" : '');
    }
}
