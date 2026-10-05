<?php

namespace App\Support;

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Release;
use App\Models\Photo;
use App\Models\Post;

/**
 * Which models band members can be linked to, by morph alias.
 *
 * The alias is what `memberables.memberable_type` stores, so it is part of the
 * data: never rename one. Each later link (news, concerts, clips…) is one
 * entry here plus the HasMembers trait on its model. An alias must match the
 * model's alias in ClipOwners when a model is in both maps — a class has one
 * morph alias across the whole app.
 */
final class MemberLinks
{
    public const MAP = [
        'photo' => Photo::class,
        'post'  => Post::class,
        // Same alias as in ClipOwners: one class, one alias, app-wide.
        'concert' => Concert::class,
        'clip'    => Clip::class,
        // Same alias as in ClipOwners.
        'release' => Release::class,
    ];

    /** SiteRebuild area whose baked pages show this kind of content. */
    private const DIRTY = [
        'photo' => 'photos',
        'post'  => 'posts',
        'concert' => 'concerts',
        'clip'    => 'band-members',
        'release' => 'releases',
    ];

    public static function dirtyArea(string $alias): ?string
    {
        return self::DIRTY[$alias] ?? null;
    }
}
