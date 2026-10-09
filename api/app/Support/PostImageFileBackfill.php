<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
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
 * Runs once, from a migration. Two outcomes besides success:
 *
 * - A value that is not a decodable data URL is cleared: the resources would
 *   otherwise prefix it with `/storage/` and serve a broken link forever.
 * - A file the disk refuses to write (full, read-only — both have happened
 *   on this stack) leaves the row untouched, so the only copy of the picture
 *   is never replaced by a path to nothing. `remaining()` tells the migration
 *   whether that happened, and it stops before shrinking the column.
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

        // Keyed by id, not offset: the callback rewrites the column the
        // `where` filters on, so an offset-paged walk would skip every
        // second chunk as converted rows dropped out of the result set.
        self::pending()
            ->select(['id', 'image'])
            ->chunkById(100, function ($rows) use ($disk, &$changed) {
                foreach ($rows as $row) {
                    [$ok, $path] = self::writeFile($disk, (string) $row->image);
                    if (! $ok) {
                        continue;
                    }

                    DB::table('posts')->where('id', $row->id)->update(['image' => $path]);
                    $changed++;
                }
            });

        return $changed;
    }

    /** Rows still holding a data URL — non-zero only when a write failed. */
    public static function remaining(): int
    {
        return self::pending()->count();
    }

    private static function pending(): \Illuminate\Database\Query\Builder
    {
        return DB::table('posts')->where('image', 'like', 'data:%');
    }

    /**
     * @return array{bool, ?string} [row may be updated, the path or null to clear]
     */
    private static function writeFile(Filesystem $disk, string $dataUrl): array
    {
        if (! preg_match('#^data:(image/[a-z]+);base64,(.*)$#s', $dataUrl, $m)) {
            return [true, null];
        }

        $ext = self::MIME_EXT[strtolower($m[1])] ?? null;
        $bytes = base64_decode($m[2], true);
        if ($ext === null || $bytes === false || $bytes === '') {
            return [true, null];
        }

        $path = 'post-images/' . Str::random(40) . '.' . $ext;
        if ($disk->put($path, $bytes) !== true) {
            return [false, null];
        }

        return [true, $path];
    }
}
