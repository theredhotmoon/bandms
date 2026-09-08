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
     *
     * Six queries per chunk, not per post: each pivot table (and post_links)
     * is fetched once for the whole chunk via whereIn and grouped in PHP,
     * rather than once per post via pivotIds() in a loop. A chunk of 100
     * posts previously issued up to 600 queries for this step alone.
     */
    public static function run(): void
    {
        DB::table('posts')->orderBy('id')->chunkById(100, function ($posts) {
            $ids = $posts->pluck('id')->all();

            $pressReleaseIds = self::pivotIdsForMany('press_release_posts', 'press_release_id', $ids);
            $releaseIds      = self::pivotIdsForMany('post_releases', 'release_id', $ids);
            $musicVideoIds   = self::pivotIdsForMany('post_music_videos', 'music_video_id', $ids);
            $concertIds      = self::pivotIdsForMany('post_concerts', 'concert_id', $ids);
            $albumIds        = self::pivotIdsForMany('post_albums', 'album_id', $ids);
            $links           = self::linksForMany($ids);

            $rows = [];
            $now  = now();

            foreach ($posts as $post) {
                $blocks = self::blocksFor([
                    'content'           => $post->content,
                    'press_release_ids' => $pressReleaseIds[$post->id] ?? [],
                    'release_ids'       => $releaseIds[$post->id] ?? [],
                    'music_video_ids'   => $musicVideoIds[$post->id] ?? [],
                    'concert_ids'       => $concertIds[$post->id] ?? [],
                    'album_ids'         => $albumIds[$post->id] ?? [],
                    'links'             => $links[$post->id] ?? [],
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

    /**
     * Every row of a post↔entity pivot table for a batch of posts, in one
     * query, grouped by post_id and ordered the same way pivotIds() (the
     * per-post version this replaced) ordered its single post's rows.
     *
     * @param  int[]  $postIds
     * @return array<int, int[]> post_id => ordered list of related ids
     */
    private static function pivotIdsForMany(string $table, string $column, array $postIds): array
    {
        $rows = DB::table($table)
            ->whereIn('post_id', $postIds)
            ->orderBy('post_id')->orderBy($column)
            ->get(['post_id', $column]);

        return array_map(
            fn ($group) => array_map(fn ($r) => $r->$column, $group),
            self::groupByPostId($rows),
        );
    }

    /**
     * Every post_links row for a batch of posts, in one query, grouped and
     * ordered the same way the per-post query this replaced was ordered.
     *
     * @param  int[]  $postIds
     * @return array<int, list<array{type: string, url: string, label: ?string}>>
     */
    private static function linksForMany(array $postIds): array
    {
        $rows = DB::table('post_links')
            ->whereIn('post_id', $postIds)
            ->orderBy('post_id')->orderBy('sort_order')->orderBy('id')
            ->get(['post_id', 'type', 'url', 'label']);

        return array_map(
            fn ($group) => array_map(fn ($r) => (array) $r, $group),
            self::groupByPostId($rows),
        );
    }

    /**
     * Groups already-fetched rows by post_id, preserving each group's
     * incoming order. Pure — takes any iterable of objects/arrays carrying a
     * post_id field, no DB — so it can be tested directly with plain arrays.
     * pivotIdsForMany()/linksForMany() themselves cannot be: by the time a
     * test runs, the drop migration has already removed both the tables they
     * query and the columns run() reads from posts (same reason blocksFor()
     * is pure and tested separately from run()).
     *
     * @param  iterable<object|array>  $rows
     * @return array<int, list<object|array>>
     */
    public static function groupByPostId(iterable $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            $postId = is_array($row) ? $row['post_id'] : $row->post_id;
            $out[$postId][] = $row;
        }

        return $out;
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
