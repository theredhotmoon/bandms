# Assistant phase 1 — Translate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared `TranslatedField` component replaces every hand-rolled `.trans-row` block in the admin and carries a per-locale *Translate* button backed by a swappable `Translator` provider (DeepL first); the slug regenerate button appears on every locale row of every slug input.

**Architecture:** Backend adds `App\Assistant\Translation` (interface + Null + DeepL drivers, bound by `AssistantServiceProvider` from `config/assistant.php`), two admin endpoints (`capabilities`, `translate`) and provider language codes in the locale registry. Frontend adds `api/assistant.ts` → `useAssistant*` composables → `TranslatedField.vue`/`TranslateFormButton.vue`, then migrates forms one PR at a time; each migration is accepted by the form's existing E2E spec staying green.

**Tech Stack:** Laravel 11 / Pest, `Http::fake()`; Vue 3 + TS, TanStack Query v5, vue-i18n, vitest (`.spec.ts`), Playwright with `page.route`.

**Spec:** `docs/superpowers/specs/2026-10-29-admin-assistant-design.md` — Phase 1 sections.

## Global Constraints

- No `'en'`/`'pl'` literal outside `api/config/locales.php`, `web/src/lib/locales.ts`, `app/src/locales.ts`. Tests use `Locales::codes()` / `LOCALES` / `DEFAULT_LOCALE`.
- Keys: env → `config/services.php`; declared in `backend.environment` of **both** `docker-compose.yml` and `docker-compose.prod.yml`; never in `site_settings`.
- `ASSISTANT_TRANSLATOR` unset ⇒ `none` ⇒ `capabilities.translate=false` ⇒ no button rendered (not disabled — absent). Applies in prod too.
- Translate never overwrites a non-empty value without the confirm press; form-level fill never touches a non-empty value.
- CI never reaches a real provider: Pest fakes `Http`; Playwright `page.route`s `/api/admin/assistant/*`.
- Admin conventions (`app/CLAUDE.md`): api file → composable → component; unit-tested logic in `src/utils/*.ts` with `*.spec.ts`; no literal English in templates — new strings go in `app/src/i18n/{en,pl}/*.ts`; `i18n-ignore` only on a const in `<script>`.
- E2E selects locale rows by `[data-locale="…"]`, never `.first()`.
- Commits: Conventional Commits (`feat(admin): …`, `feat(api): …`, `test(e2e): …`); one squash-merged PR per migration group; push once per review round.
- DeepL English target is `EN-GB` (spec open question 1, recommended default — flip one registry value if the band chooses US).
- Google driver is **not** built in this plan (spec open question 2, recommended default); the switch and registry code leave room for it.

## Review Focus

Inputs the spec implies but no task's tests would otherwise cover; each has its pinning test in the owning task.

1. **HTML with Tiptap attributes** (`<a href>` with `target`, `<p>` nesting) must survive translation byte-for-byte in tags — pinned in Task 3 (`preserves HTML tags`).
2. **Whitespace-only source text** ("   ") must count as empty: no button, not sent — pinned in Task 5 (`translationSource` spec) and Task 3 (422 on blank `text`).
3. **Two rows filled, third empty, three locales**: source is the first filled in *content order*, not registry order — pinned in Task 5.
4. **Provider 429/5xx once then success**: one retry, no error toast — pinned in Task 3.
5. **Confirm state expires**: a second press after 3 s is a *new* first press, not a replace — pinned in Task 6.

---

### Task 1: Slug regenerate on every locale row

**Files:**
- Modify: `app/src/components/admin/forms/TranslatedSlugInput.vue` (props block lines 26–51, template `v-if` line 133)
- Modify: `app/src/components/admin/forms/ShopItemForm.vue:232-238`, `app/src/components/admin/forms/BatchPhotoUpload.vue:108-114`
- Test: `app/e2e/tests/admin/album-slugs.spec.ts`, `app/e2e/tests/admin/shop.spec.ts`

**Interfaces:**
- Produces: `TranslatedSlugInput` prop `source?: string` — one untranslated source applied to every locale; a form passes `source` **or** `sources`, never both (dev-only `console.warn` if both).

- [ ] **Step 1: Write the failing E2E assertions**

In `album-slugs.spec.ts` after the existing line 33 (`en` slug value check), and in `shop.spec.ts` inside the create test before Save:

```ts
for (const l of LOCALES) {
  await expect(page.locator(`.slug-row[data-locale="${l}"] .slug-regen`)).toBeVisible()
}
```
(import `LOCALES` from `../../../src/locales` the way other specs import `DEFAULT_LOCALE`.)

- [ ] **Step 2: Run them to see the `pl` row fail**

Run: `cd app && pnpm exec playwright test e2e/tests/admin/album-slugs.spec.ts e2e/tests/admin/shop.spec.ts`
Expected: FAIL — `.slug-row[data-locale="pl"] .slug-regen` not visible.

- [ ] **Step 3: Add `source?: string` to `TranslatedSlugInput`**

Add a computed `effectiveSources(): Partial<Record<Lang,string>>` — `props.source !== undefined ? Object.fromEntries(contentLocales.map(l => [l, props.source])) : props.sources` — and use it everywhere `props.sources` is read (the `followLoaded` check line 77, the `watch` line 98, `regenerate()` line 110, the template `v-if` line 133). Update the docblock: an untranslated name is the source for every locale.

- [ ] **Step 4: Switch the two forms**

`ShopItemForm`: `:source="form.name"`. `BatchPhotoUpload`: `:source="meta.title"`, and delete the "An album title is one string … typed by hand" comment.

- [ ] **Step 5: Run the two specs, then the admin unit suite**

Run: `cd app && pnpm exec playwright test e2e/tests/admin/album-slugs.spec.ts e2e/tests/admin/shop.spec.ts && pnpm test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/admin/forms/TranslatedSlugInput.vue app/src/components/admin/forms/ShopItemForm.vue app/src/components/admin/forms/BatchPhotoUpload.vue app/e2e/tests/admin/album-slugs.spec.ts app/e2e/tests/admin/shop.spec.ts
git commit -m "fix(admin): offer slug regenerate on every locale of merch and album forms"
```

---

### Task 2: Translator contract, registry codes, capabilities endpoint

**Files:**
- Modify: `api/config/locales.php` (each `supported.*` entry gains `translation`), `api/app/Support/Locales.php`, `api/config/services.php`, `api/bootstrap/providers.php`, `api/routes/api.php` (the "Any authenticated user" block at ~line 232 — publishers use translated forms too)
- Create: `api/config/assistant.php`, `api/app/Assistant/Translation/Translator.php`, `api/app/Assistant/Translation/TranslationItem.php`, `api/app/Assistant/Translation/TranslatorUnavailable.php`, `api/app/Assistant/Translation/NullTranslator.php`, `api/app/Providers/AssistantServiceProvider.php`, `api/app/Http/Controllers/Admin/AssistantController.php`
- Test: `api/tests/Feature/AssistantCapabilitiesTest.php`, `api/tests/Unit/LocalesTranslationCodeTest.php`

**Interfaces:**
- Produces:
  ```php
  final readonly class TranslationItem { public function __construct(public string $key, public string $text, public string $format /* 'text'|'html' */, public string $source, public string $target) {} }
  interface Translator {
      public function name(): string;                       // 'deepl' | 'none'
      /** @param TranslationItem[] $items  @return array<string,string> key => translated text */
      public function translate(array $items): array;      // throws TranslatorUnavailable
  }
  final class TranslatorUnavailable extends \RuntimeException { public function __construct(public readonly string $userMessage, ?\Throwable $previous = null) }
  Locales::translationCode(string $locale, string $provider): string   // throws InvalidArgumentException when missing
  ```
- `config/assistant.php`: `['translator' => env('ASSISTANT_TRANSLATOR', 'none'), 'max_items' => 50, 'max_chars' => 20000, 'cache_ttl_days' => 30, 'throttle' => '60,1']`
- `config/services.php`: `'deepl' => ['api_key' => env('DEEPL_API_KEY')]`
- Routes (inside the `auth:api` any-user group): `GET /api/admin/assistant/capabilities` → `AssistantController@capabilities`, name `api.admin.assistant.capabilities`; `POST /api/admin/assistant/translate` → `@translate`, `->middleware('throttle:60,1,assistant-translate')`, name `api.admin.assistant.translate` (handler added in Task 3; register the route now returning 503 via `NullTranslator`).
- `capabilities` response: `{ data: { translate: bool, rewrite: false } }` where `translate = !($translator instanceof NullTranslator)`.

- [ ] **Step 1: Write failing tests**

`LocalesTranslationCodeTest.php` (Pest):
```php
it('resolves a provider code for every registered locale', function () {
    foreach (Locales::codes() as $code) {
        expect(Locales::translationCode($code, 'deepl'))->toBeString()->not->toBe('');
    }
});
it('rejects an unknown provider', fn () => expect(fn () => Locales::translationCode(Locales::default(), 'nope'))->toThrow(InvalidArgumentException::class));
it('uses a regional English for DeepL', fn () => expect(Locales::translationCode(Locales::default(), 'deepl'))->toMatch('/^[A-Z]{2}-[A-Z]{2}$/'));
```
`AssistantCapabilitiesTest.php`:
```php
it('returns 401 anonymously', fn () => $this->getJson('/api/admin/assistant/capabilities')->assertUnauthorized());
it('reports translate off when no translator is configured', function () {
    config(['assistant.translator' => 'none']);
    $this->actingAsUser();
    $this->getJson('/api/admin/assistant/capabilities')->assertOk()->assertJsonPath('data.translate', false)->assertJsonPath('data.rewrite', false);
});
it('reports translate off when deepl is chosen but has no key', function () {
    config(['assistant.translator' => 'deepl', 'services.deepl.api_key' => '']);
    $this->actingAsUser();
    $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.translate', false);
});
it('answers 503 on translate when unconfigured', function () {
    config(['assistant.translator' => 'none']);
    $this->actingAsUser();
    $this->postJson('/api/admin/assistant/translate', ['items' => []])->assertStatus(503);
});
```
(The third test passes only after Task 3 adds the DeepL binding; mark it `->todo()` until then or write the binding's "no key ⇒ Null" branch now — the provider already knows the rule.)

- [ ] **Step 2: Run to verify failure**

Run: `docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$(grep '^APP_KEY=' .env | cut -d= -f2-)" bandms_test --filter Assistant`
Expected: FAIL — route not found / class not found.

- [ ] **Step 3: Registry + `Locales::translationCode()`**

In `locales.php` add to `en`: `'translation' => ['deepl' => 'EN-GB']`, to `pl`: `'translation' => ['deepl' => 'PL']`. Document in the file header that the key is server-only and the TS mirrors do not carry it. Implement the static method reading `config("locales.supported.$locale.translation.$provider")`.

- [ ] **Step 4: Contract classes, Null driver, provider, controller, routes**

`AssistantServiceProvider::register()` binds `Translator::class` as a singleton: match on `config('assistant.translator')` — `'deepl'` with a non-empty `services.deepl.api_key` ⇒ `DeepLTranslator` (Task 3; until then leave the arm returning `NullTranslator`), anything else ⇒ `NullTranslator`. `NullTranslator::translate()` throws `TranslatorUnavailable('Translation is not configured on this server.')`. Controller `translate()` for now: `try { … } catch (TranslatorUnavailable $e) { return response()->json(['message' => $e->userMessage], 503); }` around a call with an empty item list.

- [ ] **Step 5: Run the Assistant filter and the full backend suite**

Run: same docker command with `--filter Assistant`, then `bash rebuild.sh --backend-only`
Expected: PASS; rebuild summary all green.

- [ ] **Step 6: Commit**

```bash
git add api/config api/app/Assistant api/app/Providers/AssistantServiceProvider.php api/bootstrap/providers.php api/app/Support/Locales.php api/app/Http/Controllers/Admin/AssistantController.php api/routes/api.php api/tests
git commit -m "feat(api): add the assistant translator contract and capabilities endpoint"
```

---

### Task 3: DeepL driver and the translate endpoint

**Files:**
- Create: `api/app/Assistant/Translation/DeepLTranslator.php`, `api/app/Http/Requests/Admin/TranslateRequest.php`
- Modify: `api/app/Http/Controllers/Admin/AssistantController.php`, `api/app/Providers/AssistantServiceProvider.php` (the `deepl` arm)
- Test: `api/tests/Feature/AssistantTranslateTest.php`

**Interfaces:**
- Consumes: Task 2's `Translator`, `TranslationItem`, `TranslatorUnavailable`, `Locales::translationCode()`.
- Produces: `POST /api/admin/assistant/translate` body `{ items: [{ key, text, format, source, target }] }` → `200 { data: { items: [{ key, text }], provider } }`; `422` on: `items` missing/empty/`>50`; `text` blank or `>20000` chars; `format ∉ {text,html}`; `source`/`target ∉ Locales::codes()`; `source === target`. `503 { message }` on `TranslatorUnavailable`.
- `DeepLTranslator::__construct(string $apiKey, int $cacheTtlDays)`; endpoint host `api-free.deepl.com` when `str_ends_with($apiKey, ':fx')`, else `api.deepl.com`; one `POST /v2/translate` per (source, target, format) group with `text[]`, `source_lang`, `target_lang`, `tag_handling=html` for html; header `Authorization: DeepL-Auth-Key {key}`; `Http::timeout(15)->retry(2, 500, fn ($e, $req) => status is 429 or ≥500)`. Status 456 ⇒ `TranslatorUnavailable('DeepL quota reached for this month.')`; 401/403 ⇒ `TranslatorUnavailable('DeepL rejected the API key.')`; other failure ⇒ `TranslatorUnavailable('Translation failed — try again.')`. Per item: `Cache::remember('assistant:tr:'.sha1("deepl|$source|$target|$format|$text"), now()->addDays($ttl), …)`; cached items are excluded from the request. Logs `Log::info('assistant.translate', ['provider','items','chars','cached'])`.

- [ ] **Step 1: Write failing Pest tests**

```php
beforeEach(function () {
    config(['assistant.translator' => 'deepl', 'services.deepl.api_key' => 'test-key:fx']);
    $this->actingAsUser();
});
function item(array $o = []): array { return array_merge(['key' => 'k', 'text' => 'Hello', 'format' => 'text', 'source' => Locales::default(), 'target' => collect(Locales::codes())->first(fn ($c) => $c !== Locales::default())], $o); }
function fakeDeepL(array $texts): void { Http::fake(['api-free.deepl.com/*' => Http::response(['translations' => array_map(fn ($t) => ['text' => $t], $texts)])]); }

it('translates items and reports the provider', function () {
    fakeDeepL(['Cześć']);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
        ->assertOk()->assertJsonPath('data.items.0.text', 'Cześć')->assertJsonPath('data.provider', 'deepl');
    Http::assertSent(fn ($r) => $r['target_lang'] === Locales::translationCode(item()['target'], 'deepl') && $r->hasHeader('Authorization', 'DeepL-Auth-Key test-key:fx'));
});
it('sends tag_handling=html for html items and preserves tags', function () {
    fakeDeepL(['<p>Cześć <a href="/x" target="_blank">tu</a></p>']);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item(['format' => 'html', 'text' => '<p>Hello <a href="/x" target="_blank">here</a></p>'])]])
        ->assertOk()->assertJsonPath('data.items.0.text', '<p>Cześć <a href="/x" target="_blank">tu</a></p>');
    Http::assertSent(fn ($r) => $r['tag_handling'] === 'html');
});
it('serves a repeat from cache without a second HTTP call', function () {
    fakeDeepL(['Cześć']);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk()->assertJsonPath('data.items.0.text', 'Cześć');
    Http::assertSentCount(1);
});
it('retries once on 429 then succeeds', function () {
    Http::fake(['api-free.deepl.com/*' => Http::sequence()->push([], 429)->push(['translations' => [['text' => 'Cześć']]])]);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
    Http::assertSentCount(2);
});
it('maps quota exhaustion to 503 with a user message', function () {
    Http::fake(['api-free.deepl.com/*' => Http::response([], 456)]);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertStatus(503)->assertJsonPath('message', 'DeepL quota reached for this month.');
});
it('uses the paid host for a non-free key', function () {
    config(['services.deepl.api_key' => 'paid-key']);
    Http::fake(['api.deepl.com/*' => Http::response(['translations' => [['text' => 'x']]])]);
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
});
it('validates the body', function (array $bad) {
    $this->postJson('/api/admin/assistant/translate', ['items' => [item($bad)]])->assertStatus(422);
})->with([
    'same locale'   => [['target' => Locales::default()]],
    'unknown locale'=> [['target' => 'xx']],
    'blank text'    => [['text' => '   ']],
    'oversize text' => [['text' => str_repeat('a', 20001)]],
    'bad format'    => [['format' => 'md']],
]);
it('rejects more than 50 items', fn () => $this->postJson('/api/admin/assistant/translate', ['items' => array_fill(0, 51, item())])->assertStatus(422));
it('is rate limited under its own key', fn () => expect(app('router')->getRoutes()->getByName('api.admin.assistant.translate')->middleware())->toContain('throttle:60,1,assistant-translate'));
it('returns 401 anonymously', function () { Passport::actingAs(null); … }) // or a separate test without beforeEach auth
```
Plus `capabilities` returns `translate: true` under this `beforeEach`.

- [ ] **Step 2: Run, expect failures**

Run: docker test command with `--filter AssistantTranslate`
Expected: FAIL — 503 / class missing.

- [ ] **Step 3: Implement `TranslateRequest`, `DeepLTranslator`, controller body, provider arm**

Controller: `$items = array_map(fn ($i) => new TranslationItem(...), $request->validated('items'))`; `$out = $translator->translate($items)`; return `['data' => ['items' => array_map(fn ($i) => ['key' => $i->key, 'text' => $out[$i->key]], $items), 'provider' => $translator->name()]]`. Validation of `source !== target` is a closure rule on each item.

- [ ] **Step 4: Run the filter, then the full backend suite**

Run: `--filter Assistant`, then `bash rebuild.sh --backend-only`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/Assistant api/app/Http api/app/Providers api/tests
git commit -m "feat(api): translate admin text through DeepL behind the assistant endpoint"
```

---

### Task 4: Frontend API + composables + pure helpers

**Files:**
- Create: `app/src/api/assistant.ts`, `app/src/types/assistant.ts`, `app/src/composables/useAssistant.ts`, `app/src/utils/translationSource.ts`, `app/src/utils/translationSource.spec.ts`, `app/src/utils/translationFill.ts`, `app/src/utils/translationFill.spec.ts`
- Modify: `app/src/i18n/en/common.ts`, `app/src/i18n/pl/common.ts` (new `common.assistant.*` keys, below)

**Interfaces:**
- Produces:
  ```ts
  // types/assistant.ts
  export type TranslateFormat = 'text' | 'html'
  export interface TranslateItem { key: string; text: string; format: TranslateFormat; source: Lang; target: Lang }
  export interface AssistantCapabilities { translate: boolean; rewrite: boolean }
  // api/assistant.ts
  export function fetchAssistantCapabilities(token: string): Promise<AssistantCapabilities>
  export function translateItems(token: string, items: TranslateItem[]): Promise<{ items: Record<string, string>; provider: string }>  // throws ApiError with server `message`
  // composables/useAssistant.ts
  export function useAssistantCapabilities(): { capabilities: Ref<AssistantCapabilities>, canTranslate: ComputedRef<boolean> }   // useQuery(['assistant-capabilities']), staleTime: Infinity, default {translate:false,rewrite:false}
  export function useTranslate(): { translate: (items: TranslateItem[]) => Promise<Record<string,string>>, pending: Ref<Set<string>> }  // pending holds item keys in flight; errors surface via toast.error(saveErrorMessage(e, t('common.assistant.translateFailed'))) and rethrow
  // utils/translationSource.ts
  export function isFilled(v: string | null | undefined): boolean                      // trims; '<p></p>' counts as empty for html — strip tags first
  export function sourceFor(bag: TranslationBag, target: Lang, order: readonly Lang[]): Lang | null   // first l in order, l !== target, isFilled(bag[l])
  // utils/translationFill.ts
  export function emptyTargets(bag: TranslationBag, order: readonly Lang[]): Lang[]
  export function planFill(fields: Record<string, TranslationBag>, order: readonly Lang[], formats: Record<string, TranslateFormat>): TranslateItem[]  // key = `${field}.${target}`; one item per empty locale that has a source
  export function applyFill(fields: Record<string, TranslationBag>, translated: Record<string, string>): Record<string, TranslationBag>  // writes only into locales that are still empty at apply time
  ```
- i18n keys (en shown; pl written by the implementer): `common.assistant.translateFrom: 'Translate from {lang}'`, `replaceWithTranslation: 'Replace with translation? Press again to confirm'`, `translateEmpty: 'Translate empty fields'`, `translateFailed: 'Translation failed'`, `translated: 'Translated'`.

- [ ] **Step 1: Write failing specs**

`translationSource.spec.ts`:
```ts
const [a, b, c] = ['aa', 'bb', 'cc'] as unknown as Lang[]   // registry-independent fake locales
it('picks the first filled locale in content order, skipping the target', () =>
  expect(sourceFor({ [a]: '', [b]: 'x', [c]: 'y' } as TranslationBag, a, [c, b, a])).toBe(c))
it('ignores whitespace and empty html', () => {
  expect(sourceFor({ [a]: '   ', [b]: '<p></p>' } as TranslationBag, c, [a, b, c])).toBeNull()
})
it('never returns the target itself', () => expect(sourceFor({ [a]: 'x' } as TranslationBag, a, [a])).toBeNull())
```
`translationFill.spec.ts`:
```ts
it('plans one item per empty locale with a source and none for filled ones', () => {
  const items = planFill({ title: { [a]: 'T', [b]: '' }, body: { [a]: '', [b]: '' } } as any, [a, b], { title: 'text', body: 'html' })
  expect(items).toEqual([{ key: 'title.' + b, text: 'T', format: 'text', source: a, target: b }])
})
it('applies only into still-empty locales', () =>
  expect(applyFill({ title: { [a]: 'T', [b]: 'typed meanwhile' } } as any, { ['title.' + b]: 'X' })).toEqual({ title: { [a]: 'T', [b]: 'typed meanwhile' } }))
```

- [ ] **Step 2: Run to fail**

Run: `cd app && pnpm vitest run src/utils/translationSource.spec.ts src/utils/translationFill.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the four files and the i18n keys**

`api/assistant.ts` follows `api/contentLocales.ts` (`API_BASE`, `authHeaders`, `handleResponse`). `useAssistant.ts` follows `useAlbums.ts` for `useAuth().token`.

- [ ] **Step 4: Run specs + i18n catalogue guard**

Run: `cd app && pnpm vitest run src/utils src/i18n`
Expected: PASS (catalogue spec confirms en/pl key parity).

- [ ] **Step 5: Commit**

```bash
git add app/src/api/assistant.ts app/src/types/assistant.ts app/src/composables/useAssistant.ts app/src/utils/translation*.ts app/src/i18n
git commit -m "feat(admin): add the assistant translate API layer and fill helpers"
```

---

### Task 5: `TranslatedField.vue` and `TranslateFormButton.vue`

**Files:**
- Create: `app/src/components/admin/forms/TranslatedField.vue`, `app/src/components/admin/forms/TranslatedField.spec.ts`, `app/src/components/admin/forms/TranslateFormButton.vue`
- Modify: `app/src/components/admin/form-styles.css` (add `.trans-translate` button style beside `.slug-regen`'s)

**Interfaces:**
- Consumes: Task 4's composables/helpers; `useContentLocales().order`; `inject(VISIBLE_LOCALES, null)` from `@/utils/editorLocales`; `RichEditor.vue`; `shortLabel()` from `@/locales`.
- Produces:
  ```ts
  // TranslatedField.vue — props
  { modelValue: TranslationBag; kind: 'input' | 'textarea' | 'rich'; label?: string; fieldKey: string;
    placeholders?: Partial<Record<Lang,string>>; errors?: Partial<Record<Lang,string|undefined>>;
    required?: boolean; locales?: Lang[]; rows?: number; maxlength?: number; format?: TranslateFormat }
  // emits: 'update:modelValue': [TranslationBag]
  // DOM contract: one `.trans-row[data-locale=l]` (`--top` for textarea/rich) per locale; `.lang-badge.lang-badge--<l>`;
  //   control carries `data-testid="trans-input-<l>"`; translate button `.trans-translate[data-locale=l][data-source=<src>]`,
  //   `data-confirm="true"` while in confirm state; absent (v-if) when !canTranslate or sourceFor()===null.
  // TranslateFormButton.vue — props { fields: Record<string, TranslationBag>; formats: Record<string, TranslateFormat>; locales?: Lang[] }
  //   emits 'filled': [Record<string, TranslationBag>]; renders nothing when !canTranslate or planFill().length === 0;
  //   issues one translateItems() call per field in parallel (Promise.allSettled), emits once with applyFill of the fulfilled ones.
  ```
- Behaviour: click on empty target ⇒ translate; click on filled target ⇒ enter confirm state for 3000 ms (`data-confirm`), second click within it ⇒ translate & replace, timer expiry ⇒ back to normal (a later click is a first click again). `required` is set only on the row whose locale is `useContentLocales().primary`.

- [ ] **Step 1: Write failing component spec** (`@vue/test-utils`, mock `useAssistant` and `useContentLocales` with `vi.mock`)

```ts
it('renders a row per locale in content order with only the primary required')
it('hides the translate button when capability is off')
it('hides the translate button on a row with no other filled locale')
it('fills an empty target on one click and emits the new bag')
it('needs a second click within 3 s to replace a filled target', async () => { /* vi.useFakeTimers(); click → data-confirm=true, translate not called; advance 3001 ms → data-confirm gone; click → still not called; click again → called */ })
it('passes html format for kind=rich')
```

- [ ] **Step 2: Run to fail**

Run: `cd app && pnpm vitest run src/components/admin/forms/TranslatedField.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both components**

Row markup is the existing `.trans-row` block lifted from `ConcertForm.vue:358-361/386-389` with the badge; `kind` switches `<input>` / `<textarea>` / `<RichEditor>`. Button icon: reuse the SVG shape pattern of `.slug-regen` (a ↔ arrows path). Tooltip/aria-label: `t('common.assistant.translateFrom', { lang: shortLabel(source) })`, in confirm state `t('common.assistant.replaceWithTranslation')`.

- [ ] **Step 4: Run spec, then the whole admin unit suite and the build**

Run: `cd app && pnpm vitest run && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build`
Expected: PASS; build green (this is the `vue-tsc -b` that CI runs).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/admin/forms/TranslatedField.vue app/src/components/admin/forms/TranslatedField.spec.ts app/src/components/admin/forms/TranslateFormButton.vue app/src/components/admin/form-styles.css
git commit -m "feat(admin): add TranslatedField with a per-locale translate button"
```

---

### Task 6: Migrate ConcertForm + the assistant E2E spec (first PR boundary)

**Files:**
- Modify: `app/src/components/admin/forms/ConcertForm.vue` (name block ~356–366, description block ~384–394; drop its private `.trans-row`/`.lang-badge` CSS at ~730–737 once unused)
- Create: `app/e2e/tests/admin/assistant-translate.spec.ts`
- Modify: `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml` (backend env: `ASSISTANT_TRANSLATOR: "${ASSISTANT_TRANSLATOR:-none}"`, `DEEPL_API_KEY: "${DEEPL_API_KEY:-}"`), `docs/deployment.md` §6 secrets table, `CHANGELOG.md`

**Interfaces:**
- Consumes: `TranslatedField` (`fieldKey="concert.name"` kind input, `fieldKey="concert.description"` kind textarea `rows=2`), `TranslateFormButton` with `fields={ name: form.name, description: form.description }` placed directly above the `TranslatedSlugInput`.

- [ ] **Step 1: Write the failing E2E spec**

`assistant-translate.spec.ts` (`storageState` admin; `page.route(/\/api\/admin\/assistant\/capabilities$/, …{data:{translate:true,rewrite:false}})`; `page.route(/\/api\/admin\/assistant\/translate$/, r => r.fulfill({ json: { data: { items: JSON.parse(r.request().postData()!).items.map((i: any) => ({ key: i.key, text: `[${i.target}] ${i.text}` })), provider: 'fake' } } }))`; opens the new-concert form):

```ts
test('fills an empty locale from the filled one', …)            // type name in order[0]; click `.trans-translate[data-locale=order[1]]`; expect trans-input-order[1] value `[order[1]] <name>`
test('replacing a filled locale needs a second press', …)        // fill both; one click → data-confirm=true, value unchanged; second click → replaced
test('translate-empty-fields skips a filled field', …)           // name both filled, description only order[0]; click button; description order[1] filled, name untouched; one translate request
test('renders no buttons when the capability is off', …)         // route capabilities translate:false; expect `.trans-translate` count 0 and no "Translate empty fields"
```
Use `order` from the served `content-locales` route (reuse the helper shape in `content-display-locale.spec.ts`).

- [ ] **Step 2: Run to fail**

Run: `cd app && pnpm exec playwright test e2e/tests/admin/assistant-translate.spec.ts`
Expected: FAIL — `.trans-translate` not found.

- [ ] **Step 3: Migrate ConcertForm**

Replace the two hand-rolled blocks with `<TranslatedField v-model="form.name" kind="input" field-key="concert.name" :label="…" :placeholders="…" :errors="…" required />` and the textarea equivalent; errors mapping: build `Partial<Record<Lang,string>>` from `errors?.[\`name.${l}\`]?.[0]`. Add `<TranslateFormButton :fields="{ name: form.name, description: form.description }" :formats="{ name: 'text', description: 'text' }" @filled="b => { form.name = b.name; form.description = b.description }" />`.

- [ ] **Step 4: Env plumbing and docs**

Add the two vars to both compose files and `.env.example` (commented: `none|deepl`); three rows in `docs/deployment.md` §6; `CHANGELOG.md` entry under Unreleased: "Admin: translate button on concert name/description; slug regenerate on every locale of merch and album forms".

- [ ] **Step 5: Verify**

Run: `cd app && pnpm exec playwright test e2e/tests/admin/assistant-translate.spec.ts e2e/tests/admin/concerts.spec.ts e2e/tests/admin/concert-band-play-time.spec.ts && pnpm build`
Then: `bash rebuild.sh` (frontend image needs the new component; summary green) and `docker exec bandms_backend printenv ASSISTANT_TRANSLATOR` ⇒ `none`.
Expected: all PASS.

- [ ] **Step 6: Commit, review, ship PR 1**

```bash
git add -A app/src/components/admin/forms/ConcertForm.vue app/e2e/tests/admin/assistant-translate.spec.ts .env.example docker-compose.yml docker-compose.prod.yml docs/deployment.md CHANGELOG.md
git commit -m "feat(admin): translate concert fields through the assistant"
```
Then `/code-review`, squash the branch to one commit (`git reset --soft main && git commit`), push once, `gh pr create` titled `feat(admin): add the assistant translate button and provider layer`. The remaining tasks continue on a new branch from `main` after merge: `feature/assistant-translate-forms`.

---

### Migration recipe (Tasks 7–13)

Each task below is the same five steps; only the file, the fields and the accepting spec differ.

1. Run the form's existing E2E spec(s) — must be green before touching it.
2. Replace every `.trans-row` block with `<TranslatedField>` (`kind` per control, `fieldKey` as listed, `required` on the title-like field), map `errors` per locale, add `<TranslateFormButton>` where the task says.
3. Delete the form's now-unused private `.trans-row`/`.lang-badge` CSS (ReleaseForm has a copy).
4. Run: the form's E2E spec(s) + `pnpm vitest run` + `pnpm build`. Expected: PASS, no new strings in templates (the i18n guards in the unit suite stay green).
5. Commit `refactor(admin): move <Form> onto TranslatedField`.

| Task | File | Fields → `fieldKey` (kind) | Form button | Accepting specs |
|---|---|---|---|---|
| 7 | `PostForm.vue` | title → `post.title` (input), intro → `post.intro` (textarea). Pass `:locales="visibleLocales"` (existing filter) | **none** (blocks are an array — spec) | `posts.spec.ts`, `post-event-date.spec.ts`, `post-list-flags.spec.ts` |
| 8 | `ReleaseForm.vue` | title → `release.title` (input), description → `release.description` (rich) | title+description | `releases.spec.ts`, `release-slugs.spec.ts` |
| 9 | `TagForm.vue`, `ClipForm.vue`, `InstrumentForm.vue` | name → `tag.name` / `clip.title` / `instrument.name` (input) | yes on each | `clips.spec.ts`, `instruments.spec.ts`, tags via `concerts.spec.ts` tag flow |
| 10 | `FaqEditor.vue` | question → `faq.question` (input), answer → `faq.answer` (textarea); rows gain `data-locale` via the component | per FAQ row | `faqs.spec.ts` |
| 11 | `WebsiteModulesView.vue` | **reshape** `draftSettings` from `Record<\`${key}.${locale}\`, string>` to `Record<key, TranslationBag>` with `toDraft(settings)`/`toPayload(draft)` in a new `src/utils/moduleCopyDraft.ts` (+ spec: round-trip, blank ⇒ null); each copy field → `module.<slug>.<field.key>` (input or textarea per `field.type`); remove the `en:`/`pl:` literals (~line 208) and `toUpperCase()` badges | per copy group (`<details>`) | `website-modules.spec.ts`-equivalent (`rebuild-bar`, `content-languages`, and the module copy specs under `e2e/tests/admin/`) |
| 12 | `blocks/TextBlockEditor.vue`, `ImageBlockEditor.vue`, `EmbedBlockEditor.vue` | body → `post.block.text` (rich), caption → `post.block.caption` (input), title → `post.block.embed` (input); `locales` from `inject(VISIBLE_LOCALES)` already handled inside the component | none | `posts.spec.ts`, `post-clip-block.spec.ts`, `post-ref-quick-add.spec.ts` |
| 13 | `BandProfileAdminView.vue` | bio_short/medium → textarea, bio_long/full → rich, `fieldKey` `profile.bio_*`; **keeps its language tabs**: pass `:locales="[bioLang]"` so each tab shows one row, and the translate button on that row reads from the other locale | one button in the tab toolbar | `band-profile.spec.ts` (chained project — run via its project name) |

Task 11 and 13 each get their own PR; 7–10 and 12 may share one. After Task 13: delete `.trans-row`/`.lang-badge` from `form-styles.css` if the component owns them scoped (grep first), and commit `refactor(admin): drop the hand-rolled trans-row styles`.

---

### Task 14: Documentation

**Files:**
- Modify: `CLAUDE.md` (new section under *Known footguns* or a short *Admin assistant* section), `app/CLAUDE.md` (TranslatedField in the forms conventions), `CHANGELOG.md`

- [ ] **Step 1: Write** — one section covering: `ASSISTANT_TRANSLATOR` unset ⇒ no buttons (not disabled); provider codes live in `config/locales.php` only; the first-filled-locale source rule and why; the per-field request shape and why not one request; `TranslatedField` is the only way to render a translated input (a new `.trans-row` in a form is a regression); E2E mocks the two endpoints.
- [ ] **Step 2: Commit** `docs: document the assistant translate layer and TranslatedField`.

---

## Self-review notes

- Spec coverage: slug gap → T1; registry codes/`Locales::translationCode` → T2; config/env/unset=none → T2, T6; capabilities → T2; translate endpoint, DeepL, html, cache, retry, 456/403 mapping, 422s, throttle key → T3; api/composables/helpers/i18n → T4; component incl. confirm state, required-on-primary, VISIBLE_LOCALES, form button parallel/partial → T5; migration order & WebsiteModulesView reshape & BandProfile tabs → T6–13; docs → T14. Google driver: deliberately out (Global Constraints).
- Types: `TranslateItem`/`TranslationItem` field names match across T3/T4 (`key,text,format,source,target`); response shape `data.items[]/data.provider` used identically in T3 tests, T4 api and T6 route mock.
- Review Focus pins: #1 T3 html test; #2 T3 blank-text 422 + T4 `isFilled`; #3 T4 `sourceFor` order test; #4 T3 retry test; #5 T5 fake-timer test.
