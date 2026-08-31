<?php

namespace App\Http\Controllers;

use App\Http\Resources\FaqResource;
use App\Http\Resources\FaqSummaryResource;
use App\Models\Faq;
use App\Models\WebsiteModule;
use Illuminate\Http\JsonResponse;
use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FaqController extends Controller
{
    /**
     * Public: published entries, optionally for one subpage.
     *
     * Without ?module= every published question is returned, carrying its
     * module_slug so a caller can group them in one request. The Astro build
     * uses the filtered form — each page asks only for its own.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'module' => ['sometimes', 'string', 'max:60'],
        ]);

        $faqs = Faq::where('is_published', true)
            ->when(
                isset($data['module']),
                fn ($q) => $q->where('module_slug', $data['module'])
            )
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => FaqSummaryResource::collection($faqs)]);
    }

    /** Admin: everything, published or not, grouped by subpage. */
    public function adminIndex(): JsonResponse
    {
        $faqs = Faq::orderBy('module_slug')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => FaqResource::collection($faqs)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $faq = new Faq();
        $faq->module_slug = $data['module_slug'];
        $this->fill($faq, $data);
        $this->assertHasQuestion($faq);
        $this->ensureTranslatableColumns($faq);

        // New rows land at the end of THEIR subpage rather than colliding on 0,
        // which would make their order depend on the id tiebreaker instead of
        // the field. Scoped per module because sort_order is per-page.
        $faq->sort_order   = $data['sort_order']
            ?? ((int) Faq::where('module_slug', $faq->module_slug)->max('sort_order') + 1);
        $faq->is_published = $data['is_published'] ?? true;
        $faq->save();

        return response()->json(['data' => new FaqResource($faq)], 201);
    }

    public function update(Request $request, Faq $faq): JsonResponse
    {
        $data = $request->validate($this->rules(creating: false));

        if (array_key_exists('module_slug', $data)) {
            $faq->module_slug = $data['module_slug'];
        }

        $this->fill($faq, $data);
        $this->assertHasQuestion($faq);
        $this->ensureTranslatableColumns($faq);

        if (array_key_exists('sort_order', $data)) {
            $faq->sort_order = $data['sort_order'];
        }

        if (array_key_exists('is_published', $data)) {
            $faq->is_published = $data['is_published'];
        }

        $faq->save();

        return response()->json(['data' => new FaqResource($faq)]);
    }

    public function destroy(Faq $faq): JsonResponse
    {
        $faq->delete();

        return response()->json(null, 204);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'module_slug' => ['required', 'string', 'max:60'],
            'ids'         => ['required', 'array'],
            'ids.*'       => ['required', 'integer', 'exists:faqs,id'],
        ]);

        // Scoped to the named module so reordering one page cannot renumber
        // another's questions. Ids belonging to a different module are ignored
        // rather than rejected — a stale tab should not 500.
        foreach ($data['ids'] as $index => $id) {
            Faq::where('id', $id)
                ->where('module_slug', $data['module_slug'])
                ->update(['sort_order' => $index]);
        }

        return response()->json([
            'data' => FaqResource::collection(
                Faq::orderBy('module_slug')->orderBy('sort_order')->orderBy('id')->get()
            ),
        ]);
    }

    /**
     * A question always belongs to exactly one subpage.
     *
     * module_slug is validated against the live website_modules rows rather
     * than a hardcoded list, so adding a module to the CMS makes it available
     * as an FAQ category with no code change. Disabled modules are allowed:
     * switching a section off must not make its existing questions unsavable.
     */
    private function rules(bool $creating = true): array
    {
        return [
            'module_slug'  => [$creating ? 'required' : 'sometimes', 'string', 'max:60', Rule::in(WebsiteModule::pluck('slug'))],
            // `question` must be present when creating — both columns are NOT
            // NULL with no default, so omitting it died with a database error
            // where a 422 belongs. Which locales are filled is checked after the
            // merge instead of here: on update, clearing one locale is legal as
            // long as the other already holds a value, and a payload-only rule
            // like required_without cannot see the stored one.
            'question'     => [$creating ? 'required' : 'sometimes', 'array', $this->localeKeysOnly()],
            'question.en'  => ['sometimes', 'nullable', 'string', 'max:300'],
            'question.pl'  => ['sometimes', 'nullable', 'string', 'max:300'],
            // `answer` is NOT NULL with no default too, so omitting the key
            // entirely left the column out of the INSERT and produced a database
            // error. Required as an array on create; its locales may be blank,
            // since an answer can legitimately be written later.
            // Keys are restricted so an unsupported locale is a 422 rather than
            // a silent discard: fill() only reads en/pl, so `{"de": "..."}` used
            // to save with an empty answer and no word to the client.
            'answer'       => [$creating ? 'required' : 'sometimes', 'array', $this->localeKeysOnly()],
            'answer.en'    => ['sometimes', 'nullable', 'string', 'max:4000'],
            'answer.pl'    => ['sometimes', 'nullable', 'string', 'max:4000'],
            'sort_order'   => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Rejects a translatable payload carrying keys that are not locales.
     *
     * Without it a value under an unsupported key passes validation, is dropped
     * by fill(), and the row saves empty — a 201 that quietly threw the
     * submitted text away.
     */
    private function localeKeysOnly(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (!is_array($value)) {
                return;
            }

            $unknown = Locales::unsupportedKeys($value);

            if ($unknown !== []) {
                // Keyed on the bare attribute, which no field in FaqEditor owns.
                // That is deliberate — the locale it objects to has no input to
                // attach to — and safe because the editor now renders any error
                // key it does not place inline as a banner above the form.
                $fail("The {$attribute} field only accepts the locales "
                    . implode(' and ', Locales::codes()) . '.');
            }
        };
    }

    /**
     * Give every translatable column a value before the row is written.
     *
     * `question` and `answer` are both NOT NULL with no default, and Spatie only
     * touches a column via set/forgetTranslation. fill() ignores locales outside
     * en/pl, so a payload like `answer: {"de": "..."}` — or a plain list — passes
     * `required|array`, writes nothing, and the INSERT omits the column. Validating
     * that the key is *present* was never enough: what matters is that something
     * is written.
     */
    private function ensureTranslatableColumns(Faq $faq): void
    {
        foreach (['question', 'answer'] as $field) {
            if (!array_key_exists($field, $faq->getAttributes())) {
                $faq->setTranslations($field, []);
            }
        }
    }

    /**
     * A question must survive in at least one locale.
     *
     * Checked on the merged model rather than on the payload, so clearing one
     * locale stays legal while the other holds a value. A row with both blank
     * renders an empty heading in the public accordion — the outcome
     * FaqSummaryResource's locale fallback exists to prevent.
     */
    private function assertHasQuestion(Faq $faq): void
    {
        $filled = collect($faq->getTranslations('question'))->filter(fn ($v) => filled($v));

        if ($filled->isEmpty()) {
            // Keyed per locale, not on `question`. FaqEditor renders
            // errors['question.en'] and errors['question.pl'] and nothing for a
            // bare `question`, so a message on that key was invisible — the save
            // looked like a silent no-op.
            $message = 'A question is required in at least one language.';

            throw \Illuminate\Validation\ValidationException::withMessages([
                'question.en' => [$message],
                'question.pl' => [$message],
            ]);
        }
    }

    /**
     * Apply translatable fields, one locale at a time.
     *
     * setTranslations() MERGES into the existing array, so omitting a locale
     * leaves its old value in place and an emptied field appears not to save.
     * Clearing has to be an explicit forgetTranslation(). Only locales the
     * request actually names are touched, so a single-locale payload cannot
     * wipe the other language.
     */
    private function fill(Faq $faq, array $data): void
    {
        foreach (['question', 'answer'] as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            foreach (Locales::codes() as $locale) {
                if (! array_key_exists($locale, $data[$field])) {
                    continue;
                }

                filled($data[$field][$locale])
                    ? $faq->setTranslation($field, $locale, $data[$field][$locale])
                    : $faq->forgetTranslation($field, $locale);
            }
        }
    }
}
