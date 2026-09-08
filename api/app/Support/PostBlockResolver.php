<?php

namespace App\Support;

use App\Models\Album;
use App\Models\Concert;
use App\Models\MusicVideo;
use App\Models\PressRelease;
use App\Models\Release;
use App\Models\ShopItem;
use Illuminate\Support\Collection;

/**
 * Hydrates `ref` blocks in batch.
 *
 * Two things this owes the rest of the system:
 *
 *  - **One query per entity type, never one per block.** PostDetail.astro walks
 *    every page of the post index on every article page, so an N+1 here is
 *    multiplied across the entire static build.
 *  - **A missing entity resolves to null, never an exception.** The Astro build
 *    is all-or-nothing — one page that throws aborts all 35 and leaves the web
 *    container crash-looping. Returning null lets the renderer skip the block.
 */
final class PostBlockResolver
{
    /**
     * @param  Collection<int, \App\Models\PostBlock>  $blocks
     * @return array<int, array|null>  block id => identity fields, or null
     */
    public static function resolve(Collection $blocks): array
    {
        $refs = $blocks->filter(fn ($b) => $b->type === PostBlockType::REF);

        if ($refs->isEmpty()) {
            return [];
        }

        $byEntity = $refs->groupBy(fn ($b) => $b->payload['entity'] ?? '');
        $loaded   = [];

        foreach ($byEntity as $entity => $group) {
            $ids = $group->pluck('payload.id')->filter()->map(fn ($i) => (int) $i)->unique()->all();
            $loaded[$entity] = self::load($entity, $ids);
        }

        $out = [];
        foreach ($refs as $block) {
            $entity = $block->payload['entity'] ?? '';
            $id     = (int) ($block->payload['id'] ?? 0);
            $out[$block->id] = $loaded[$entity][$id] ?? null;
        }

        return $out;
    }

    /** @return array<int, array> keyed by entity id */
    private static function load(string $entity, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return match ($entity) {
            'concert' => Concert::with('venue')->whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($c) => [
                    'id'      => $c->id,
                    'slug_en' => $c->slug_en,
                    'date'    => $c->date?->format('Y-m-d'),
                    'venue'   => $c->venue ? ['id' => $c->venue->id, 'name' => $c->venue->name] : null,
                ])->all(),

            'release' => Release::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($r) => ['id' => $r->id, 'title' => $r->title, 'type' => $r->type])->all(),

            'album' => Album::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($a) => ['id' => $a->id, 'title' => $a->title])->all(),

            // ShopItem's column is `name`, not `title`.
            'shop_item' => ShopItem::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'slug_en' => $s->slug_en])->all(),

            'music_video' => MusicVideo::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($v) => [
                    'id' => $v->id, 'title' => $v->og_title ?? $v->title, 'video_url' => $v->video_url,
                ])->all(),

            'press_release' => PressRelease::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($p) => [
                    'id'    => $p->id,
                    'title' => $p->og_title ?? $p->url,
                    'url'   => $p->url,
                    // Never blank: a quote with no source reads as the band
                    // quoting itself, and article-press.spec.ts asserts it.
                    'site'  => $p->og_site_name ?: (parse_url($p->url, PHP_URL_HOST) ?: null),
                ])->all(),

            default => [],
        };
    }
}
