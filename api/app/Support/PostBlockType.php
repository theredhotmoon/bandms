<?php

namespace App\Support;

/**
 * The block vocabularies, in one place.
 *
 * `tour` is deliberately absent from REF_ENTITIES: tours have no public page of
 * any kind, so a tour reference could only ever link somewhere it isn't.
 */
final class PostBlockType
{
    public const TEXT  = 'text';
    public const IMAGE = 'image';
    public const EMBED = 'embed';
    public const REF   = 'ref';

    public const ALL = [self::TEXT, self::IMAGE, self::EMBED, self::REF];

    public const REF_ENTITIES = [
        'concert', 'album', 'release', 'music_video', 'press_release', 'shop_item',
    ];
}
