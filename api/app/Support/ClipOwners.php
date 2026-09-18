<?php

namespace App\Support;

use App\Models\Album;
use App\Models\Concert;
use App\Models\Release;
use App\Models\ShopItem;

/**
 * Which models a clip can be attached to, by morph alias.
 *
 * The alias is what `clippables.clippable_type` stores, so it is part of the
 * data: never rename one. `album` is in the map (the model is ready) but the
 * admin does not offer it — albums have no public page to show clips on.
 */
final class ClipOwners
{
    public const MAP = [
        'concert'   => Concert::class,
        'release'   => Release::class,
        'shop_item' => ShopItem::class,
        'album'     => Album::class,
    ];

    /** SiteRebuild area whose baked pages show this owner's clips. */
    private const DIRTY = [
        'concert'   => 'concerts',
        'release'   => 'releases',
        'shop_item' => 'shop',
        'album'     => 'photos',
    ];

    /** @return string[] */
    public static function aliases(): array
    {
        return array_keys(self::MAP);
    }

    public static function dirtyArea(string $alias): ?string
    {
        return self::DIRTY[$alias] ?? null;
    }
}
