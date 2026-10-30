<?php

namespace App\Assistant\Text;

use App\Models\BandProfile;
use App\Models\Concert;
use App\Models\Faq;
use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Release;
use App\Models\WebsiteModule;

/**
 * "Write like us": the band's own recent texts of the same field and
 * language, handed to the model as examples. One map from a TranslatedField
 * `fieldKey` to where that field's values live, so phase 3's "draft an
 * outreach email like us" reuses it.
 *
 * Up to 4, newest first, each capped at 1 500 chars, never the text being
 * rewritten (exclusion is by equality — the request names no record, and a
 * record's own stored value is still the band's writing; decided in the
 * design). An unknown key is simply no examples, never an error.
 */
final class StyleExamples
{
    private const MAX_EXAMPLES = 4;
    private const MAX_CHARS    = 1500;
    private const SCAN_ROWS    = 20;

    /** @return string[] */
    public static function for(string $fieldKey, string $locale, string $exclude): array
    {
        $key = preg_replace('/#.*$/', '', $fieldKey) ?? $fieldKey;

        $candidates = match (true) {
            $key === 'concert.description'       => self::translated(Concert::query()->latest()->limit(self::SCAN_ROWS)->get(), 'description', $locale),
            $key === 'post.intro'                => self::translated(Post::query()->latest()->limit(self::SCAN_ROWS)->get(), 'intro', $locale),
            $key === 'post.block.text'           => PostBlock::query()->where('type', 'text')->latest('id')->limit(self::SCAN_ROWS)->get()
                                                        ->map(fn (PostBlock $b) => $b->payload['body'][$locale] ?? null)->all(),
            $key === 'release.description'       => self::translated(Release::query()->latest()->limit(self::SCAN_ROWS)->get(), 'description', $locale),
            str_starts_with($key, 'profile.bio_') => self::otherBios(substr($key, strlen('profile.')), $locale),
            $key === 'faq.answer'                => self::translated(Faq::query()->latest()->limit(self::SCAN_ROWS)->get(), 'answer', $locale),
            str_starts_with($key, 'module.')     => self::moduleCopy($key, $locale),
            default                              => [],
        };

        $out = [];
        foreach ($candidates as $text) {
            if (!is_string($text) || trim($text) === '' || $text === $exclude) {
                continue;
            }
            $out[] = mb_substr($text, 0, self::MAX_CHARS);
            if (count($out) === self::MAX_EXAMPLES) {
                break;
            }
        }

        return $out;
    }

    /** @return array<string|null> */
    private static function translated(iterable $rows, string $field, string $locale): array
    {
        $out = [];
        foreach ($rows as $row) {
            $out[] = $row->getTranslation($field, $locale, false) ?: null;
        }

        return $out;
    }

    /** The other bio variants of the one profile — the closest thing to "this field, written before". */
    private static function otherBios(string $column, string $locale): array
    {
        $profile = BandProfile::query()->first();
        if (!$profile) {
            return [];
        }
        $out = [];
        foreach (['bio_short', 'bio_medium', 'bio_long', 'bio_full'] as $variant) {
            if ($variant !== $column) {
                $out[] = $profile->getTranslation($variant, $locale, false) ?: null;
            }
        }

        return $out;
    }

    /** `module.<slug>.<field>`: the same field on every other module. */
    private static function moduleCopy(string $key, string $locale): array
    {
        [, $slug, $field] = array_pad(explode('.', $key, 3), 3, null);
        if ($slug === null || $field === null) {
            return [];
        }

        return WebsiteModule::query()->where('slug', '!=', $slug)->get()
            ->map(fn (WebsiteModule $m) => $m->settings[$field][$locale] ?? null)
            ->all();
    }
}
