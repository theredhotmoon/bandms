<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Moves every post's main image out of the `image` column and onto the
 * public disk.
 *
 * Until Oct 2026 the admin read the picked file as a data URL and the column
 * (mediumText) held the whole base64 payload. Once the news list started
 * carrying the image (#190) every post's picture travelled in every list
 * response and was baked into the news page twice. Posts now store a path
 * under `post-images/`, like block images and release covers, and serve it
 * as `/storage/<path>`.
 *
 * Runs once, from a migration. A value that is not a decodable data URL is
 * cleared rather than left in place: the resources would otherwise prefix it
 * with `/storage/` and serve a broken link forever.
 */
final class PostImageFileBackfill
{
    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/jpg'  => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
    ];

    /** @return int rows rewritten (cleared rows included) */
    public static function run(): int
    {
        $disk = Storage::disk('public');
        $changed = 0;

        DB::table('posts')
            ->select(['id', 'image'])
            ->where('image', 'like', 'data:%')
            ->orderBy('id')
            ->each(function (object $row) use ($disk, &$changed) {
                $path = self::writeFile($disk, (string) $row->image);

                DB::table('posts')->where('id', $row->id)->update(['image' => $path]);
                $changed++;
            });

        return $changed;
    }

    /** The stored path, or null when the data URL cannot be turned into a file. */
    private static function writeFile(\Illuminate\Contracts\Filesystem\Filesystem $disk, string $dataUrl): ?string
    {
        if (! preg_match('#^data:(image/[a-z]+);base64,(.*)$#s', $dataUrl, $m)) {
            return null;
        }

        $ext = self::MIME_EXT[strtolower($m[1])] ?? null;
        $bytes = base64_decode($m[2], true);
        if ($ext === null || $bytes === false || $bytes === '') {
            return null;
        }

        $path = 'post-images/' . Str::random(40) . '.' . $ext;
        $disk->put($path, $bytes);

        return $path;
    }
}
