<?php

namespace App\Assistant\Text;

use App\Support\Locales;

/**
 * The one prompt behind Enhance. The system part is fixed rules; the user
 * part is the mode, the band's own examples of this field, and the text.
 *
 * The facts line is the first thing a reviewer of this prompt should read:
 * every mode keeps names, dates, times, places, prices, URLs and numbers
 * verbatim — a rewrite that changes a door time is worse than no rewrite.
 */
final class RewritePrompt
{
    /** @return array{system: string, user: string} */
    public static function build(RewriteRequest $r): array
    {
        $language = self::languageName($r->locale);

        $rules = [
            "You edit short texts for a band's website.",
            "Return only the rewritten text — no preamble, no commentary, no quotes around it, no markdown.",
            "Write in {$language}, the language of the input.",
            'Keep every fact verbatim: names, dates, times, places, prices, URLs and numbers must survive unchanged.',
            "Any examples show the band's voice only — never copy a name, date, time, place, price or any other fact from them into the result.",
            "The result must be no longer than {$r->maxLength} characters.",
        ];
        if ($r->format === 'html') {
            $rules[] = 'The input is HTML: keep every tag and attribute exactly as it is and change only the text inside them.';
        }

        $user = "Mode: {$r->mode->instruction()}\n\n";
        if ($r->examples !== []) {
            $user .= "Examples of how this band writes this kind of text ({$language}):\n";
            foreach ($r->examples as $example) {
                $user .= "<example>{$example}</example>\n";
            }
            $user .= "\n";
        }
        $user .= "Text:\n<text>{$r->text}</text>";

        return ['system' => implode(' ', $rules), 'user' => $user];
    }

    private static function languageName(string $locale): string
    {
        foreach (Locales::all() as $entry) {
            if ($entry['code'] === $locale) {
                return $entry['name'];
            }
        }

        return $locale;
    }
}
