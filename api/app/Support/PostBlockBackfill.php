<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

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
     * Read every post's old shape and insert its blocks.
     *
     * Uses the DB facade, not Eloquent: by the time anyone reads this, the
     * models will have moved on and Post will no longer declare these relations.
     */
    public static function run(): void
    {
        DB::table('posts')->orderBy('id')->chunkById(100, function ($posts) {
            $rows = [];
            $now  = now();

            foreach ($posts as $post) {
                $blocks = self::blocksFor([
                    'content'           => $post->content,
                    'press_release_ids' => self::pivotIds('press_release_posts', 'press_release_id', $post->id),
                    'release_ids'       => self::pivotIds('post_releases', 'release_id', $post->id),
                    'music_video_ids'   => self::pivotIds('post_music_videos', 'music_video_id', $post->id),
                    'concert_ids'       => self::pivotIds('post_concerts', 'concert_id', $post->id),
                    'album_ids'         => self::pivotIds('post_albums', 'album_id', $post->id),
                    'links'             => DB::table('post_links')
                        ->where('post_id', $post->id)
                        ->orderBy('sort_order')->orderBy('id')
                        ->get(['type', 'url', 'label'])
                        ->map(fn ($l) => (array) $l)->all(),
                ]);

                foreach ($blocks as $block) {
                    $rows[] = [
                        'post_id'    => $post->id,
                        'position'   => $block['position'],
                        'type'       => $block['type'],
                        'payload'    => json_encode($block['payload'], JSON_UNESCAPED_UNICODE),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            if ($rows !== []) {
                DB::table('post_blocks')->insert($rows);
            }
        });
    }

    /** @return int[] */
    private static function pivotIds(string $table, string $column, int $postId): array
    {
        return DB::table($table)->where('post_id', $postId)->orderBy($column)->pluck($column)->all();
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
