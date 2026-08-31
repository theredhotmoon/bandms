<?php

namespace App\Http\Controllers;

use App\Http\Resources\WebsiteModuleResource;
use App\Models\SiteSetting;
use App\Models\WebsiteModule;
use App\Support\Locales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WebsiteModuleController extends Controller
{
    public function siteConfig(): JsonResponse
    {
        $locale       = app()->getLocale();
        $all          = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();

        $modules      = $all->keyBy('slug')->map(fn ($m) => (bool) $m->enabled);
        $module_order = $all->pluck('slug')->values();
        $module_config = $all->keyBy('slug')->map(function ($m) use ($locale) {
            // The URL segment this module is served under, per locale. Empty
            // falls back to the module key, so the public site never has to
            // derive a slug from the label. Compared against '' rather than
            // via ?:, which would treat the legal slug "0" as absent.
            $slug = $m->getTranslation('custom_slug', $locale, false);

            return [
                'enabled'  => (bool) $m->enabled,
                'label'    => $m->getTranslation('custom_name', $locale, false) ?: $m->display_name,
                'slug'     => $slug === '' || $slug === null ? $m->slug : $slug,
                'per_page' => $m->per_page,
                'settings' => self::resolveSettings($m->settings, $locale),
            ];
        });

        return response()->json([
            // The locale this response was resolved in, and every locale the
            // site has. The public site builds its language switcher and
            // hreflang alternates from these rather than hardcoding a pair.
            'locale'        => $locale,
            'locales'       => Locales::all(),
            'modules'       => $modules,
            'module_order'  => $module_order,
            'module_config' => $module_config,
        ]);
    }

    /**
     * Flatten {"field": {"en": ..., "pl": ...}} to {"field": "..."} for one locale.
     *
     * Falls back down the locale's declared chain (config/locales.php) rather
     * than emitting null, on the same reasoning as FaqSummaryResource: the Astro
     * build bakes whatever it gets, and a null here renders an empty hero with a
     * green build.
     *
     * Returns an object, never null — the public site does
     * `settings.kicker ?? ''` and an absent bag would throw at build time,
     * which takes down all 35 pages rather than one.
     */
    private static function resolveSettings(?array $settings, string $locale): array
    {
        $out = [];

        foreach ($settings ?? [] as $field => $value) {
            if (! is_array($value)) {
                $out[$field] = $value;
                continue;
            }

            $out[$field] = Locales::resolve($value, $locale) ?? '';
        }

        return $out;
    }

    public function index(): JsonResponse
    {
        $modules     = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();
        $autoRebuild = SiteSetting::get('auto_rebuild', 'false') === 'true';

        return response()->json([
            'data'         => WebsiteModuleResource::collection($modules),
            'auto_rebuild' => $autoRebuild,
        ]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slugs'   => ['required', 'array'],
            'slugs.*' => ['required', 'string'],
        ]);

        foreach ($data['slugs'] as $index => $slug) {
            WebsiteModule::where('slug', $slug)->update(['sort_order' => $index]);
        }

        $modules     = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();
        $autoRebuild = SiteSetting::get('auto_rebuild', 'false') === 'true';

        return response()->json([
            'data'         => WebsiteModuleResource::collection($modules),
            'auto_rebuild' => $autoRebuild,
        ]);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $module = WebsiteModule::where('slug', $slug)->firstOrFail();

        // Per-locale rules are generated from the registry: a locale added to
        // config/locales.php is accepted here with no edit, and one that is not
        // registered is silently dropped by validate() rather than stored where
        // nothing will ever read it.
        $rules = [
            'enabled'    => ['sometimes', 'boolean'],
            'per_page'   => ['sometimes', 'nullable', 'integer', 'in:6,9,10,12,15,20,24'],
            'settings'   => ['sometimes', 'array'],
            'settings.*' => ['array'],
        ];

        foreach (Locales::codes() as $code) {
            $rules["custom_name.{$code}"] = ['sometimes', 'nullable', 'string', 'max:80'];
            $rules["custom_slug.{$code}"] = $this->slugRules($module, $code);
            $rules["settings.*.{$code}"]  = ['sometimes', 'nullable', 'string', 'max:2000'];
        }

        $validated = $request->validate($rules);

        if (array_key_exists('enabled', $validated)) {
            $module->enabled = $validated['enabled'];
        }

        if (array_key_exists('custom_name', $validated)) {
            $module->setTranslations('custom_name', collect(Locales::codes())
                ->mapWithKeys(fn (string $code) => [
                    $code => ($validated['custom_name'][$code] ?? null) ?: null,
                ])
                ->all());
        }

        if (array_key_exists('custom_slug', $validated)) {
            // Only touch locales the request actually names. custom_name above
            // overwrites both — harmless for a label, but a slug controls a live
            // URL, so a payload of {"en": "shop"} must not silently clear the
            // Polish slug and move /pl/sklep. An explicit null still clears.
            // setTranslations() MERGES rather than replaces, so a cleared locale
            // has to be forgotten explicitly — dropping it from the array would
            // silently leave the old slug in place.
            foreach (Locales::codes() as $locale) {
                if (! array_key_exists($locale, $validated['custom_slug'])) {
                    continue;
                }

                filled($validated['custom_slug'][$locale])
                    ? $module->setTranslation('custom_slug', $locale, $validated['custom_slug'][$locale])
                    : $module->forgetTranslation('custom_slug', $locale);
            }
        }

        if (array_key_exists('per_page', $validated)) {
            $module->per_page = $validated['per_page'];
        }

        if (array_key_exists('settings', $validated)) {
            // Merged per field and per locale, for the same reason custom_slug
            // is: a payload naming only the English kicker must not silently
            // blank the Polish one. An explicit null clears just that locale.
            $current = $module->settings ?? [];

            foreach ($validated['settings'] as $field => $value) {
                foreach (Locales::codes() as $locale) {
                    if (! array_key_exists($locale, $value)) {
                        continue;
                    }

                    if (filled($value[$locale])) {
                        $current[$field][$locale] = $value[$locale];
                    } else {
                        unset($current[$field][$locale]);
                    }
                }

                if (empty($current[$field])) {
                    unset($current[$field]);
                }
            }

            $module->settings = $current;
        }

        $module->save();

        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            $this->triggerRebuild();
        }

        return response()->json(['data' => new WebsiteModuleResource($module)]);
    }

    /**
     * Validation for one locale's URL slug.
     *
     * Uniqueness is checked against every other module's *effective* slug, not
     * just its stored one: a module with an empty slug is served under its key,
     * so claiming "merch" collides with the merch module even though that row
     * has no custom_slug of its own. The table holds a dozen rows, so scanning
     * the collection beats a JSON query for clarity.
     */
    private function slugRules(WebsiteModule $module, string $locale): array
    {
        return [
            'sometimes',
            'nullable',
            'string',
            'max:60',
            'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
            function (string $attribute, mixed $value, \Closure $fail) use ($module, $locale) {
                if (blank($value)) {
                    return;
                }

                $conflict = WebsiteModule::where('id', '!=', $module->id)->get()
                    ->first(function ($m) use ($locale, $value) {
                        $slug = $m->getTranslation('custom_slug', $locale, false);

                        return ($slug === '' || $slug === null ? $m->slug : $slug) === $value;
                    });

                if ($conflict) {
                    $fail("The {$locale} slug \"{$value}\" is already used by the {$conflict->display_name} module.");
                }
            },
        ];
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(['auto_rebuild' => 'required|boolean']);

        SiteSetting::set('auto_rebuild', $validated['auto_rebuild'] ? 'true' : 'false');

        return response()->json(['auto_rebuild' => $validated['auto_rebuild']]);
    }

    public function rebuild(): JsonResponse
    {
        $this->triggerRebuild();

        return response()->json(['status' => 'rebuild_started']);
    }

    public function rebuildStatus(): JsonResponse
    {
        $fallback = ['status' => 'unknown', 'startedAt' => null, 'finishedAt' => null];

        try {
            $response = Http::timeout(5)->get('http://web:3001/status');
            if (! $response->successful()) {
                return response()->json($fallback);
            }
            $body = $response->json();
            return response()->json([
                'status'     => $body['status']     ?? 'unknown',
                'startedAt'  => $body['startedAt']  ?? null,
                'finishedAt' => $body['finishedAt'] ?? null,
            ]);
        } catch (\Exception) {
            return response()->json($fallback);
        }
    }

    private function triggerRebuild(): void
    {
        try {
            Http::timeout(5)->post('http://web:3001/rebuild');
        } catch (\Exception) {
            // Fire-and-forget; webhook may be unavailable in tests or dev
        }
    }
}
