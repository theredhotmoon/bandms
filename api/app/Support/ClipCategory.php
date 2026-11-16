<?php

namespace App\Support;

/**
 * Suggested clip categories. The column is free text — a band can type its
 * own — so this list drives the admin's chips and the public label lookup,
 * not validation. Mirrored by app/src/utils/clipCategories.ts.
 */
final class ClipCategory
{
    public const PRESETS = ['music_video', 'live', 'studio', 'backstage', 'interview', 'other'];

    /** The category the Music page lists, and former music videos carry. */
    public const MUSIC_VIDEO = 'music_video';
}
