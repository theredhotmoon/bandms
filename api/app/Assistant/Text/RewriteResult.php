<?php

namespace App\Assistant\Text;

/**
 * What comes back from the model, made fit for the band's field: trimmed,
 * stripped of the quotes or the "Here is…:" line the prompt forbids, and —
 * for HTML — checked for markup the editor would never have stored.
 *
 * Both strips are guarded by the ORIGINAL text: a heading line the band
 * wrote ("Support acts:") or quotes they wrapped their own text in are
 * theirs to keep. "Facts survive" is a rule for our code as much as for
 * the model.
 */
final class RewriteResult
{
    private const QUOTE_PAIRS = [['"', '"'], ['„', '”'], ['“', '”'], ["'", "'"]];

    public static function clean(string $raw, ?string $original = null): string
    {
        $text          = trim($raw);
        $originalLines = preg_split('/\R/u', trim((string) $original)) ?: [];
        $originalFirst = rtrim($originalLines[0] ?? '');

        // A short first line ending in a colon, with more text after it, is a
        // preamble ("Here is a punchier version:") — unless the band's own
        // text starts with that line, in which case it is their heading.
        $lines = preg_split('/\R/u', $text) ?: [$text];
        $first = rtrim($lines[0]);
        if (count($lines) > 1 && mb_strlen($first) < 80 && str_ends_with($first, ':') && $first !== $originalFirst) {
            array_shift($lines);
            $text = trim(implode("\n", $lines));
        }

        foreach (self::QUOTE_PAIRS as [$open, $close]) {
            if (mb_strlen($text) <= 1 || !str_starts_with($text, $open) || !str_ends_with($text, $close)) {
                continue;
            }
            // The band wrapped their own text in this pair: keep it.
            if ($original !== null && str_starts_with(trim($original), $open) && str_ends_with(trim($original), $close)) {
                break;
            }
            $inner = mb_substr($text, mb_strlen($open), mb_strlen($text) - mb_strlen($open) - mb_strlen($close));
            // Only a pair that wraps the WHOLE text — not one that merely opens
            // and closes somewhere inside ("Hello" said X "bye").
            if (!str_contains($inner, $open) && !str_contains($inner, $close)) {
                $text = trim($inner);
            }
            break;
        }

        return $text;
    }

    /**
     * Markup the rich editor never produces and the public site must never
     * receive: script-capable or embedding tags, script/data URLs on links or
     * sources, inline handlers (inside a tag — "online = cheaper" in prose is
     * not one), and srcdoc.
     */
    public static function isUnsafeHtml(string $html): bool
    {
        return (bool) preg_match(
            '/<\s*(script|iframe|object|embed|style|svg|form|meta|link|base)\b'
            . '|(href|src|action|formaction)\s*=\s*["\']?\s*(javascript|vbscript|data)\s*:'
            . '|srcdoc\s*='
            . '|<[^>]*\son[a-z]+\s*=/i',
            $html,
        );
    }
}
