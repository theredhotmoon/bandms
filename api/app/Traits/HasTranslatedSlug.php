<?php

namespace App\Traits;

use App\Support\Locales;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * A URL slug stored as one translatable JSON column — {"en": "...", "pl": "..."}
 * — instead of a slug_<locale> column per language.
 *
 * Adding a language used to mean a migration on every table with slugs; with
 * this it is a key in config/locales.php. The using model must also list
 * 'slug' in its Spatie `$translatable`.
 *
 * Uniqueness is across ALL locales, not per column. A public route that falls
 * back from one locale's slug to another's (posts: slug_pl, else slug_en) sees
 * the union of both as one namespace, and a per-column unique rule missed one
 * record's Polish slug equalling another's English one — the silent collision
 * found in #83, where Astro built one of the two pages and dropped the other
 * with a green build. Checked here, it holds for every model by construction.
 *
 * There is no database unique index: MySQL cannot index into an arbitrary
 * JSON key set. The check is the application's, as Post's cross-column rule
 * already was.
 */
trait HasTranslatedSlug
{
    /** Records whose slug equals `$slug` in any locale — a by-slug lookup. */
    public function scopeWhereSlug(Builder $query, string $slug): Builder
    {
        return $query->where(function (Builder $q) use ($slug) {
            foreach (Locales::codes() as $code) {
                $q->orWhere("slug->{$code}", $slug);
            }
        });
    }

    /** Whether any OTHER record uses `$slug` in any locale. */
    public static function slugTaken(string $slug, ?int $ignoreId = null): bool
    {
        return static::query()
            ->whereSlug($slug)
            ->when($ignoreId, fn (Builder $q) => $q->whereKeyNot($ignoreId))
            ->exists();
    }

    /** A slug from `$source` that no other record uses in any locale. */
    public static function generateTranslatedSlug(string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: 'item';
        $slug = $base;
        $i    = 2;

        while (static::slugTaken($slug, $ignoreId)) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    /**
     * Validation for one locale of a submitted slug bag: fails when another
     * record already uses the value in any locale.
     */
    public static function uniqueTranslatedSlugRule(?int $ignoreId = null): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($ignoreId) {
            if (is_string($value) && $value !== '' && static::slugTaken($value, $ignoreId)) {
                $fail('The :attribute has already been taken.');
            }
        };
    }

    /**
     * Per-locale rules for a `slug` bag in a request, generated from the
     * registry so a new locale gets its string/max/unique rules with no edit.
     */
    public static function translatedSlugRules(?int $ignoreId = null, int $max = 255): array
    {
        $rules = ['slug' => ['sometimes', 'nullable', 'array', function (string $attribute, mixed $value, Closure $fail) {
            // An unregistered key would pass and then be dropped on save, so the
            // band's slug for it would vanish with a 200.
            if (is_array($value) && Locales::unsupportedKeys($value) !== []) {
                $fail("The {$attribute} field only accepts the locales " . implode(' and ', Locales::codes()) . '.');
            }
        }]];

        foreach (Locales::codes() as $code) {
            $rules["slug.{$code}"] = [
                'sometimes', 'nullable', 'string', "max:{$max}",
                static::uniqueTranslatedSlugRule($ignoreId),
            ];
        }

        return $rules;
    }

    /**
     * Apply a submitted slug bag under the generate-once policy (every model
     * except Tag, which re-slugs on rename by design):
     *
     * - a filled locale is taken as given;
     * - a blank NON-default locale is cleared — the band removed it;
     * - the default locale is never blanked: it is the record's stable slug,
     *   so blank keeps the existing one, and a record with none gets one
     *   generated from `$source` (usually its title).
     *
     * A locale absent from `$given` is left exactly as it is, so a partial
     * update cannot clear a slug the client did not mention.
     */
    public function applySlugBag(?array $given, ?string $source, array $localeSources = []): void
    {
        $given   = $given ?? [];
        $default = Locales::default();

        // On CREATE only, a non-default locale with no slug given gets one from
        // its own title, as Release and Post always did for Polish. Never on
        // update: adding a Polish title later must not invent a Polish URL the
        // band did not ask for.
        if (! $this->exists) {
            foreach ($localeSources as $code => $text) {
                if ($code !== $default && blank($given[$code] ?? null) && filled($text)) {
                    $given[$code] = static::generateTranslatedSlug($text);
                }
            }
        }

        foreach (Locales::codes() as $code) {
            if (! array_key_exists($code, $given)) {
                continue;
            }

            $value = is_string($given[$code]) ? trim($given[$code]) : '';

            if ($value !== '') {
                $this->setTranslation('slug', $code, $value);
            } elseif ($code !== $default) {
                $this->forgetTranslation('slug', $code);
            }
        }

        if ($this->slugIn($default) === null) {
            $this->setTranslation('slug', $default,
                static::generateTranslatedSlug($source ?: 'item', $this->getKey()));
        }
    }

    /** The slug in one locale, without Spatie's fallback to another. */
    public function slugIn(string $locale): ?string
    {
        $value = $this->getTranslation('slug', $locale, false);

        return $value === '' ? null : $value;
    }
}
