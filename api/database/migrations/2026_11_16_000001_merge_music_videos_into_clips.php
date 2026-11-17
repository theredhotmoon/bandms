<?php

use App\Support\EmbedProvider;
use App\Support\Locales;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One video library: every `music_videos` row becomes a clip, and the
 * tables that pointed at it are repointed — so no link, member page or news
 * block is lost.
 *
 * `clips` gains:
 *  - `source`: `official` (the band made it) or `fan` (someone else filmed
 *    it and the band wants to show it). A string, not a boolean, so a third
 *    kind ("press", "label") is a value and not a migration.
 *  - the metadata music videos carried: channel name, thumbnail, duration,
 *    YouTube view count and when it was last synced. `channel_url` is new —
 *    it is what credits a fan video's author with a link.
 *
 * A former music video becomes an official clip in the `music_video`
 * category, dated by its old `published_at`. It keeps the title visitors
 * saw (`og_title`, else the band's own), stays off the EPK (the public EPK
 * never rendered music videos), and is renumbered: clip ids and music-video
 * ids overlap, which is why every pointer below goes through `$map`.
 *
 * Repointed:
 *  - `memberables` `music_video` rows → `clip`
 *  - `shop_item_video` → `clippables` as `shop_item` owners
 *  - `post_blocks` refs `{entity: music_video}` → `{entity: clip}`; a ref to
 *    a video already deleted is dropped
 *
 * Irreversible, deliberately: the down() of a data merge would have to split
 * clips back apart, and a clip created after this ran has no music-video
 * shape to go back to.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Guarded so the data half can be re-run by its test against legacy
        // tables it recreates; on a real database this always adds them.
        if (! Schema::hasColumn('clips', 'source')) {
            $this->addColumns();
        }

        if (! Schema::hasTable('music_videos')) {
            return;
        }

        DB::transaction(function () {
            $map = $this->copyVideos();

            $this->repointMembers($map);
            $this->repointShopItems($map);
            $this->repointPostBlocks($map);
        });

        Schema::dropIfExists('shop_item_video');
        Schema::dropIfExists('music_videos');
    }

    private function addColumns(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            $table->string('source', 16)->default('official')->after('category');
            $table->string('channel_name')->nullable()->after('source');
            $table->string('channel_url', 500)->nullable()->after('channel_name');
            $table->string('thumbnail_url', 1000)->nullable()->after('channel_url');
            $table->string('duration', 20)->nullable()->after('thumbnail_url');
            $table->unsignedBigInteger('view_count')->nullable()->after('duration');
            $table->timestamp('views_synced_at')->nullable()->after('view_count');
            $table->index('source');
        });
    }

    public function down(): void
    {
        // Irreversible — see the class docblock.
    }

    /** @return array<int, int> old music-video id => new clip id */
    private function copyVideos(): array
    {
        $map = [];
        $locale = Locales::default();

        $videos = DB::table('music_videos')->orderBy('sort_order')->orderBy('id')->get();

        foreach ($videos as $v) {
            $title = trim((string) ($v->og_title ?: $v->title));

            $map[(int) $v->id] = (int) DB::table('clips')->insertGetId([
                'provider'        => EmbedProvider::detect($v->video_url),
                'url'             => $v->video_url,
                'title'           => $title === '' ? null : json_encode([$locale => $title], JSON_UNESCAPED_UNICODE),
                'category'        => 'music_video',
                'source'          => 'official',
                'recorded_on'     => $v->published_at,
                'show_in_epk'     => false,
                'channel_name'    => $v->channel_name,
                'thumbnail_url'   => $v->og_image,
                'duration'        => $v->duration,
                'view_count'      => $v->view_count,
                'views_synced_at' => $v->views_synced_at,
                'created_at'      => $v->created_at,
                'updated_at'      => $v->updated_at,
            ]);
        }

        return $map;
    }

    /** @param array<int, int> $map */
    private function repointMembers(array $map): void
    {
        if ($map === [] || ! Schema::hasTable('memberables')) {
            return;
        }

        foreach ($map as $old => $new) {
            DB::table('memberables')
                ->where('memberable_type', 'music_video')->where('memberable_id', $old)
                ->update(['memberable_type' => 'clip', 'memberable_id' => $new]);
        }
    }

    /**
     * A shop item's linked videos become clips attached to it, after any it
     * already had, in the order the old pivot held them.
     *
     * @param array<int, int> $map
     */
    private function repointShopItems(array $map): void
    {
        if (! Schema::hasTable('shop_item_video')) {
            return;
        }

        $rows = DB::table('shop_item_video')->orderBy('shop_item_id')->orderBy('music_video_id')->get();

        foreach ($rows as $row) {
            $clipId = $map[(int) $row->music_video_id] ?? null;
            if ($clipId === null) {
                continue;
            }

            $owner = ['clip_id' => $clipId, 'clippable_type' => 'shop_item', 'clippable_id' => (int) $row->shop_item_id];
            if (DB::table('clippables')->where($owner)->exists()) {
                continue;
            }

            $max = DB::table('clippables')
                ->where('clippable_type', 'shop_item')->where('clippable_id', $row->shop_item_id)
                ->max('position');

            DB::table('clippables')->insert($owner + ['position' => $max === null ? 0 : (int) $max + 1]);
        }
    }

    /**
     * A ref block keeps every other payload key; only what it points at
     * changes. A ref to a video that no longer exists is deleted: it rendered
     * nothing already, and `music_video` is no longer an entity the post
     * form accepts — left in place, it would make that post unsaveable.
     *
     * @param array<int, int> $map
     */
    private function repointPostBlocks(array $map): void
    {
        if (! Schema::hasTable('post_blocks')) {
            return;
        }

        $blocks = DB::table('post_blocks')->where('type', 'ref')->get(['id', 'payload']);

        foreach ($blocks as $block) {
            $payload = json_decode($block->payload, true);
            if (! is_array($payload) || ($payload['entity'] ?? null) !== 'music_video') {
                continue;
            }

            $clipId = $map[(int) ($payload['id'] ?? 0)] ?? null;
            if ($clipId === null) {
                DB::table('post_blocks')->where('id', $block->id)->delete();

                continue;
            }

            $payload['entity'] = 'clip';
            $payload['id'] = $clipId;

            DB::table('post_blocks')->where('id', $block->id)
                ->update(['payload' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
        }
    }
};
