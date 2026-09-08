<?php

namespace App\Support;

use App\Models\Post;
use Illuminate\Support\Facades\Storage;

/**
 * Replaces a post's blocks and cleans up the images that fall out of use.
 *
 * Delete-and-recreate, matching what post_links did — but `position` is set
 * explicitly from the array index rather than left to auto-increment id order.
 * The old arrangement only worked by accident, and scrambles the editor's drag
 * order the moment anything stops recreating from scratch.
 */
final class PostBlockSync
{
    /** @param list<array{type: string, payload: array}> $blocks */
    public static function sync(Post $post, array $blocks): void
    {
        $oldPaths = self::imagePaths($post->blocks()->get()->all());

        $post->blocks()->delete();

        foreach ($blocks as $i => $block) {
            $post->blocks()->create([
                'position' => $i,
                'type'     => $block['type'],
                'payload'  => $block['payload'],
            ]);
        }

        $newPaths = array_column(
            array_filter($blocks, fn ($b) => $b['type'] === PostBlockType::IMAGE),
            'payload'
        );
        $newPaths = array_filter(array_column($newPaths, 'path'));

        foreach (array_diff($oldPaths, $newPaths) as $orphan) {
            Storage::disk('public')->delete($orphan);
        }
    }

    /** Every image path a post's blocks reference. Used on delete, too. */
    public static function imagePaths(array $blocks): array
    {
        return array_values(array_filter(array_map(
            fn ($b) => $b->type === PostBlockType::IMAGE ? ($b->payload['path'] ?? null) : null,
            $blocks
        )));
    }
}
