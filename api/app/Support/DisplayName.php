<?php

namespace App\Support;

use App\Models\BandProfile;
use Illuminate\Validation\ValidationException;

/**
 * The name a fan's comments appear under: one definition for the two places
 * that accept it (the first comment, and PUT /api/fan/me).
 */
class DisplayName
{
    public const MAX = 50;

    /**
     * Characters that render as nothing and are never part of a name:
     * zero-width space, word joiner, soft hyphen, BOM, the bidi controls.
     * Deliberately NOT all of \p{Cf} — U+200C/U+200D (ZWNJ, ZWJ) hold emoji
     * sequences and Persian and Indic spellings together.
     */
    private const INVISIBLE = '/[\x{00AD}\x{061C}\x{180E}\x{200B}\x{200E}\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}]+/u';

    /** @return list<string> */
    public static function rules(): array
    {
        return ['required', 'string', 'max:' . self::MAX];
    }

    /** Trimmed, invisibles dropped, every kind of space collapsed to one; a non-string is left for validation. */
    public static function clean(mixed $name): mixed
    {
        if (! is_string($name)) {
            return $name;
        }

        $name = preg_replace(self::INVISIBLE, '', $name) ?? '';

        return trim(preg_replace('/[\s\p{Z}]+/u', ' ', $name) ?? '');
    }

    /** True when the text shows nothing at all — spaces and invisible characters only. */
    public static function isBlank(string $text): bool
    {
        return preg_replace('/[\s\p{Z}\p{Cf}]+/u', '', $text) === '';
    }

    /**
     * A fan may not post under the band's own name — the one impersonation
     * that would read as an official statement. Compared with spaces and
     * invisible characters removed: "SkankingStorks" reads as the band too.
     *
     * This is all it stops. Names are not unique, and a look-alike letter from
     * another alphabet, a member's name or another commenter's name all pass;
     * Block fan is the answer to those.
     */
    public static function assertAllowed(string $name): void
    {
        // clean() keeps the joiners (ZWJ/ZWNJ) for the names that need them,
        // so a name made of nothing else would pass `required` and print as a
        // blank author on the site and in the band's mail.
        if (self::isBlank($name)) {
            throw ValidationException::withMessages([
                'display_name' => [__('validation.required', ['attribute' => 'display name'])],
            ]);
        }

        $squash = fn (string $s): string => mb_strtolower(preg_replace('/[\s\p{Z}\p{Cf}]+/u', '', $s) ?? '');
        $band = BandProfile::query()->value('name');

        if (is_string($band) && $squash($band) !== '' && $squash($band) === $squash($name)) {
            throw ValidationException::withMessages([
                'display_name' => [__('api.fan.display_name_reserved')],
            ]);
        }
    }
}
