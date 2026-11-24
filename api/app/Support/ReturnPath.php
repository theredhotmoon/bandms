<?php

namespace App\Support;

/**
 * Where a sign-in link may send a fan back to: a path on this site, nothing
 * else. `//host` and `/\host` are protocol-relative URLs to a browser, so a
 * leading slash alone is not enough. Mirrored by app/src/utils/returnPath.ts
 * and web/src/lib/comments.ts — the three must agree.
 */
class ReturnPath
{
    public const MAX = 300;

    public static function clean(mixed $value): ?string
    {
        if (! is_string($value) || $value === '' || mb_strlen($value) > self::MAX) {
            return null;
        }
        if (! mb_check_encoding($value, 'UTF-8')) {
            return null; // a JS string cannot hold this, so the two copies have no such line
        }
        if ($value[0] !== '/' || str_starts_with($value, '//') || str_contains($value, '\\')) {
            return null;
        }
        if (preg_match('/[\x00-\x1F\x7F]/', $value)) {
            return null;
        }

        return $value;
    }
}
