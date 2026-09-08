<?php

namespace App\Support;

/**
 * Converts a post's pre-blocks shape into ordered block rows.
 *
 * blocksFor() is deliberately pure — no DB, no models. The test stage applies
 * every migration at setup, so a test running after the drop migration would
 * find posts.content and the pivots already gone. Handing this function the old
 * shape directly is the only way to assert on the conversion at all.
 */
final class PostBlockBackfill
{
    /** Emitted in the order PostDetail.astro renders today. */
    private const REF_ORDER = [
        'press_release_ids' => 'press_release',
        'release_ids'       => 'release',
        'music_video_ids'   => 'music_video',
        'concert_ids'       => 'concert',
        'album_ids'         => 'album',
    ];

    /**
     * @param  array{content: ?string, press_release_ids: int[], release_ids: int[],
     *               music_video_ids: int[], concert_ids: int[], album_ids: int[],
     *               links: list<array{type: string, url: string, label: ?string}>}  $source
     * @return list<array{position: int, type: string, payload: array}>
     */
    public static function blocksFor(array $source): array
    {
        $blocks   = [];
        $position = 0;

        $body = self::decodeContent($source['content'] ?? null);
        if ($body !== null) {
            $blocks[] = ['position' => $position++, 'type' => PostBlockType::TEXT, 'payload' => ['body' => $body]];
        }

        foreach (self::REF_ORDER as $key => $entity) {
            foreach ($source[$key] ?? [] as $id) {
                $blocks[] = [
                    'position' => $position++,
                    'type'     => PostBlockType::REF,
                    'payload'  => ['entity' => $entity, 'id' => (int) $id],
                ];
            }
        }

        foreach ($source['links'] ?? [] as $link) {
            $blocks[] = [
                'position' => $position++,
                'type'     => PostBlockType::EMBED,
                'payload'  => [
                    // Re-detected, never mapped from the old `type` column: that
                    // column carries `facebook`, which is not a provider here.
                    'provider' => EmbedProvider::detect($link['url']),
                    'url'      => $link['url'],
                    'label'    => $link['label'] ?? null,
                ],
            ];
        }

        return $blocks;
    }

    /**
     * The translations bag, or null when there is nothing worth a block.
     *
     * A bare string predates the translatable migration; wrapping it as English
     * loses nothing, while dropping it loses the whole article body.
     *
     * @return array{en: ?string, pl: ?string}|null
     */
    private static function decodeContent(?string $raw): ?array
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        $bag = is_array($decoded) ? $decoded : ['en' => $raw];

        $en = trim((string) ($bag['en'] ?? '')) !== '' ? $bag['en'] : null;
        $pl = trim((string) ($bag['pl'] ?? '')) !== '' ? $bag['pl'] : null;

        return ($en === null && $pl === null) ? null : ['en' => $en, 'pl' => $pl];
    }
}
