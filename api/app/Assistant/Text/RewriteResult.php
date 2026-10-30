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

        // Drop a first line only when it reads as a PREAMBLE ("Here is a
        // punchier version:", "Oto poprawiona wersja:") — never merely because
        // it is short and ends in a colon: "Line-up:", "Bilety:" are the band's
        // own headings, and so is a heading the model reworded. If the band's
        // text opened with a `…:` line, the rewrite's first line is theirs.
        $lines = preg_split('/\R/u', $text) ?: [$text];
        $first = rtrim($lines[0]);
        if (count($lines) > 1
            && mb_strlen($first) < 80
            && str_ends_with($first, ':')
            && $first !== $originalFirst
            && self::looksLikePreamble($first)
        ) {
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
     * The phrases a model opens with when it ignores "no preamble". Words of
     * the languages the band writes in, not locale codes — a third language
     * whose preamble is not listed simply keeps that line, which is the safe
     * failure (an extra line the band deletes beats a heading silently lost).
     */
    private static function looksLikePreamble(string $line): bool
    {
        // (*UCP): \b and \w follow Unicode, so "Złoto" is one word, not "Zł"+"oto".
        $noun = '(versions?|rewrites?|texts?|takes?|drafts?|results?|edits?|it|'
            . 'wersj\w*|tekst\w*|propozycj\w*)';
        $adj  = '(rewritten|revised|improved|edited|polished|punchier|shorter|longer|tighter|new|'
            . 'poprawion\w*|przepisan\w*|now\w*|krótsz\w*|dłuższ\w*|zmienion\w*)';

        $patterns = [
            // A bare acknowledgement: "Sure!", "Certainly —", "Jasne,".
            '/^(sure|certainly|of course|okay|ok|absolutely|jasne|oczywiście|pewnie)\b/iu',
            // A lead-in that points at THE TEXT: "Here's a tighter take:", "Oto
            // poprawiona wersja:" — but not "Here are the dates:", which points
            // at the band's content.
            "/^(here(\\s+is|\\s+are|['’]s)?|below(\\s+is)?|this\\s+is|tutaj|oto|poniżej|to\\s+jest)\\b.*\\b{$noun}\\b/iu",
            // A label naming the rewrite itself: "Punchier rewrite:", "Rewritten
            // version:" — not "Acoustic version:" or "Revised setlist:".
            "/^(the\\s+|a\\s+)?{$adj}\\s+{$noun}\\b/iu",
        ];

        foreach ($patterns as $pattern) {
            // The verb goes inside the delimiter: "/(*UCP)^…/iu".
            if (preg_match('/(*UCP)' . substr($pattern, 1), $line)) {
                return true;
            }
        }

        return false;
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
