<?php

namespace App\Support;

/**
 * Who made a video. `official`: the band. `fan`: someone else filmed it and
 * the band chose to show it — the public site labels it and credits the
 * channel. Mirrored by app/src/utils/clipSources.ts.
 */
final class ClipSource
{
    public const OFFICIAL = 'official';
    public const FAN      = 'fan';

    public const ALL = [self::OFFICIAL, self::FAN];
}
