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
 * Adding a provider is one entry in HOSTS plus one arm in embedId() — and one
 * arm in web/src/components/blocks/EmbedBlock.astro.
 */
final class EmbedProvider
{
    public const PROVIDERS = ['youtube', 'vimeo', 'instagram', 'tiktok', 'link'];

    /** Host suffix => provider. Checked longest-first is unnecessary; suffixes are disjoint. */
    private const HOSTS = [
        'youtube.com'   => 'youtube',
        'youtu.be'      => 'youtube',
        'vimeo.com'     => 'vimeo',
        'instagram.com' => 'instagram',
        'tiktok.com'    => 'tiktok',
    ];

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
            default     => null,
        };
    }

    private static function match(string $pattern, string $url): ?string
    {
        return preg_match($pattern, $url, $m) === 1 ? $m[1] : null;
    }
}
