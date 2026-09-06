<?php

namespace App\Http\Controllers;

use App\Http\Resources\TagResource;
use App\Models\Tag;
use App\Support\Locales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        // Ordered by the request's own locale's JSON path, matching what
        // TagResource actually resolves and displays for this response —
        // sorting by the raw `name` column would sort by its JSON-encoded
        // text, which stops matching alphabetical order for any tag with no
        // value in whichever locale happens to serialise first.
        return TagResource::collection(
            Tag::orderBy('name->' . app()->getLocale())->get()
        );
    }

    public function store(Request $request): TagResource
    {
        $data = $request->validate($this->rules());

        $tag = new Tag();
        $this->fill($tag, $data);
        $this->assertHasName($tag);
        $this->applySlugs($tag, $data);
        $tag->save();

        return new TagResource($tag);
    }

    public function show(Tag $tag): TagResource
    {
        return new TagResource($tag);
    }

    public function update(Request $request, Tag $tag): TagResource
    {
        $data = $request->validate($this->rules($tag));

        $this->fill($tag, $data);
        $this->assertHasName($tag);
        $this->applySlugs($tag, $data);
        $tag->save();

        return new TagResource($tag);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $tag->delete();

        return response()->json(null, 204);
    }

    /**
     * Per-locale rules generated from the registry, mirroring FaqController.
     * Listing `name.en`/`name.pl` by hand would let a newly registered locale
     * through localeKeysOnly() with no string/max rule behind it.
     */
    private function rules(?Tag $tag = null): array
    {
        $rules = [
            'name'     => ['required', 'array', $this->localeKeysOnly()],
            'slug_en'  => ['nullable', 'string', 'max:100', Rule::unique('tags', 'slug_en')->ignore($tag)],
            'slug_pl'  => ['nullable', 'string', 'max:100', Rule::unique('tags', 'slug_pl')->ignore($tag)],
        ];

        foreach (Locales::codes() as $code) {
            $rules["name.{$code}"] = [
                'sometimes', 'nullable', 'string', 'max:100',
                Rule::unique('tags', "name->{$code}")->ignore($tag),
            ];
        }

        return $rules;
    }

    /**
     * Rejects a name payload carrying keys that are not registered locales —
     * an unsupported key would otherwise pass validation and be silently
     * dropped by fill(), saving the tag with that text thrown away.
     */
    private function localeKeysOnly(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (!is_array($value)) {
                return;
            }

            $unknown = Locales::unsupportedKeys($value);

            if ($unknown !== []) {
                $fail("The {$attribute} field only accepts the locales "
                    . implode(' and ', Locales::codes()) . '.');
            }
        };
    }

    /**
     * A tag must survive in at least one locale, same rationale as
     * FaqController::assertHasQuestion — an all-blank name would render an
     * empty pill on the public site rather than 500ing at save time.
     */
    private function assertHasName(Tag $tag): void
    {
        $filled = collect($tag->getTranslations('name'))->filter(fn ($v) => filled($v));

        if ($filled->isEmpty()) {
            $message = 'A tag name is required in at least one language.';

            throw \Illuminate\Validation\ValidationException::withMessages(
                collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => ["name.{$code}" => [$message]])
                    ->all(),
            );
        }
    }

    /**
     * setTranslations() merges into the existing array, so omitting a locale
     * would leave its old value in place — clearing has to be an explicit
     * forgetTranslation(). Only locales the request actually names are
     * touched, so a single-locale payload cannot wipe the other language.
     */
    private function fill(Tag $tag, array $data): void
    {
        if (!array_key_exists('name', $data)) {
            return;
        }

        foreach (Locales::codes() as $locale) {
            if (!array_key_exists($locale, $data['name'])) {
                continue;
            }

            filled($data['name'][$locale])
                ? $tag->setTranslation('name', $locale, $data['name'][$locale])
                : $tag->forgetTranslation('name', $locale);
        }
    }

    /**
     * Regenerated on every save, matching this controller's pre-existing
     * behaviour of re-slugging on rename (unlike Post, which only
     * auto-generates on create). slug_en always gets a value — from the
     * English name, or the first filled locale if English is blank — so it
     * can anchor the public filter key and, later, a URL. slug_pl tracks
     * whether a Polish name exists, including clearing it when one no longer
     * does. An explicit slug in the payload wins over auto-generation.
     */
    private function applySlugs(Tag $tag, array $data): void
    {
        $translations = $tag->getTranslations('name');
        $nameEn       = $translations['en'] ?? (reset($translations) ?: 'tag');
        $namePl       = $translations['pl'] ?? null;

        $tag->slug_en = ($data['slug_en'] ?? null) ?: Tag::generateSlug($nameEn, $tag->id, 'slug_en');
        $tag->slug_pl = ($data['slug_pl'] ?? null) ?: ($namePl ? Tag::generateSlug($namePl, $tag->id, 'slug_pl') : null);
    }
}
