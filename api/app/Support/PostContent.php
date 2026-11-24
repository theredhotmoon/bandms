<?php

namespace App\Support;

use App\Models\Post;

/**
 * What a reader would call the article: its title, intro, main image and body.
 * Two snapshots are equal when nobody reading it could tell the saves apart —
 * the order MySQL returns JSON keys in, and an absent key against a null one or
 * an all-blank translation bag (what the form resends for it), do not count.
 */
final class PostContent
{
    public static function snapshot(Post $post): array
    {
        return self::canonical([
            'title' => $post->getTranslations('title'),
            'intro' => $post->getTranslations('intro'),
            'image' => $post->image,
        ]);
    }

    /** @param iterable<mixed> $blocks stored PostBlocks, or the validated request's arrays */
    public static function blocks(iterable $blocks): array
    {
        return collect($blocks)
            ->map(fn ($b) => self::canonical(['type' => $b['type'], 'payload' => $b['payload']]))
            ->values()
            ->all();
    }

    private static function canonical(mixed $value): mixed
    {
        // The round trip drops objects and resolves what would be stored.
        return self::sorted(json_decode(json_encode($value), true));
    }

    private static function sorted(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            return array_map(self::sorted(...), $value);
        }

        $value = array_filter(array_map(self::sorted(...), $value), fn ($v) => $v !== null && $v !== '' && $v !== []);
        ksort($value);

        return $value;
    }
}
