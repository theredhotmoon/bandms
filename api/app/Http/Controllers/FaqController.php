<?php

namespace App\Http\Controllers;

use App\Http\Resources\FaqResource;
use App\Http\Resources\FaqSummaryResource;
use App\Models\Faq;
use App\Models\WebsiteModule;
use Illuminate\Http\JsonResponse;
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
            'question.en'  => ['sometimes', 'nullable', 'string', 'max:300'],
            'question.pl'  => ['sometimes', 'nullable', 'string', 'max:300'],
            'answer.en'    => ['sometimes', 'nullable', 'string', 'max:4000'],
            'answer.pl'    => ['sometimes', 'nullable', 'string', 'max:4000'],
            'sort_order'   => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
        ];
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

            foreach (['en', 'pl'] as $locale) {
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
