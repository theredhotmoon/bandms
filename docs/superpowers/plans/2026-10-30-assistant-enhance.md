# Assistant phase 2 — Enhance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An ✦ Enhance menu (flow · punchier · shorter · longer · press) on every textarea/rich row of `TranslatedField`, rewriting the text in its own language and in the band's voice through a swappable `TextModel` (Anthropic default), with Undo.

**Architecture:** Backend adds `App\Assistant\Text` (`TextModel` interface with `rewrite()` and `structured()`, `AnthropicTextModel` on the official PHP SDK, `NullTextModel`, `RewriteMode`, `RewritePrompt`, `RewriteResult`, `StyleExamples`), one endpoint, and the `rewrite` capability flag. Frontend adds `useEnhance`, `rewriteModes.ts`, `enhanceUndo.ts`, `EnhanceMenu.vue`, and wires it into `TranslatedField.vue` beside the Translate button. One PR.

**Tech Stack:** Laravel 11 + `anthropic-ai/sdk` (composer, PHP ≥ 8.1) + Pest; Vue 3 + TS + TanStack Query + vitest; Playwright with `page.route`.

**Spec:** `docs/superpowers/specs/2026-10-30-assistant-enhance-design.md` (+ umbrella `2026-10-29-admin-assistant-design.md`).

## Global Constraints

- Model id only from config: `ASSISTANT_TEXT_MODEL` default `claude-opus-5-5`; driver `ASSISTANT_TEXT_MODEL_DRIVER` = `anthropic|none`, unset ⇒ `none` ⇒ `capabilities.rewrite=false` ⇒ no control rendered. Key `ANTHROPIC_API_KEY` in both compose files + `.env.example` + `docs/deployment.md`.
- Every Anthropic call: `maxTokens: 16000`, `outputConfig: ['effort' => 'medium']`, thinking omitted (adaptive default), `betas: ['server-side-fallback-2026-07-01']` + `fallbacks: 'default'` through `$client->beta->messages->create(...)`; **no** `cacheControl` (prompt is below the cacheable minimum). Parameter names are the PHP SDK's camelCase — copy from the SDK's `examples/` when unsure; never guess.
- CI never reaches Anthropic: `FakeTextModel` bound in feature tests; the driver is unit-tested with a stub client passed through its constructor.
- No `'en'`/`'pl'` literals outside the registry; language names from `Locales::all()`.
- Input cap `min(maxLength, 20000)`; result over `maxLength` or `stop_reason === 'max_tokens'` ⇒ 503, never a truncated field.
- Admin conventions as in phase 1 (api → composable → component; utils + `.spec.ts`; i18n ratchet; no literal English in templates).
- Commits Conventional; one squashed commit, one push; `/code-review` before merge.

## Review Focus

1. **A fact-bearing text** (`Doors 19:00, Klub Hydrozagadka, 40 zł`) must come back with every token of fact intact — pinned by the fake model echoing the text and `RewritePromptTest` asserting the facts rule is in the system prompt (Task 3).
2. **HTML input with a link** keeps `<a href="…" target="_blank">` — pinned in Task 4 (fake returns tags; `clean()` leaves them; `<script>` rejected).
3. **A reply after the band edited the row** must not land — reuse `replyStillApplies` (Task 6 E2E "late reply is dropped").
4. **Rate-limit / auth / refusal from the SDK** become three distinct 503 messages — Task 2.
5. **Undo after a second Enhance** restores the text before the *latest* rewrite, not the original — Task 5's `enhanceUndo.spec.ts`.

---

### Task 1: TextModel contract, config, capability flag, SDK dependency

**Files:**
- Modify: `api/composer.json` (`composer require anthropic-ai/sdk`), `api/config/assistant.php`, `api/config/services.php` (`anthropic.api_key`), `api/app/Providers/AssistantServiceProvider.php`, `api/app/Http/Controllers/AssistantController.php` (`capabilities`), `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `docs/deployment.md`
- Create: `api/app/Assistant/Text/TextModel.php`, `RewriteRequest.php`, `TextModelUnavailable.php`, `NullTextModel.php`
- Test: `api/tests/Feature/AssistantCapabilitiesTest.php` (extend)

**Interfaces:**
```php
final readonly class RewriteRequest { public function __construct(public string $text, public string $format /* text|html */, public string $locale, public RewriteMode $mode, public string $fieldKey, public int $maxLength, public array $examples = []) {} }
interface TextModel {
    public function name(): string;                                  // 'anthropic' | 'none'
    public function rewrite(RewriteRequest $r): string;             // throws TextModelUnavailable
    public function structured(string $system, string $user, array $schema, ?string $model = null): array;  // decoded JSON; throws TextModelUnavailable
}
final class TextModelUnavailable extends \RuntimeException { public function __construct(public readonly string $userMessage, ?\Throwable $previous = null) }
```
- `config/assistant.php` adds `'text_model' => env('ASSISTANT_TEXT_MODEL_DRIVER', 'none')`, `'text_model_id' => env('ASSISTANT_TEXT_MODEL', 'claude-opus-5-5')`, `'rewrite_max_chars' => 20000`.
- Provider binds `TextModel::class` singleton: `'anthropic'` with a non-empty key ⇒ `AnthropicTextModel` (Task 2; until then `NullTextModel`), else `NullTextModel`.
- `capabilities` returns `rewrite => !($textModel instanceof NullTextModel)`.

- [ ] **Step 1: Failing tests** — in `AssistantCapabilitiesTest`: `rewrite` is false under `assistant.text_model=none`; false under `anthropic` with empty key; `RewriteMode` not needed yet. In a new `tests/Feature/AssistantRewriteTest.php`: `POST /api/admin/assistant/rewrite` ⇒ 503 `{message}` under `none` (body: a valid item — see Task 4's `item()`).
- [ ] **Step 2: Run** — `wt-test.sh Assistant` ⇒ FAIL (route 404 / key missing).
- [ ] **Step 3: Implement** — `composer require anthropic-ai/sdk` (rebuild the test image once: the vendor stage changes), contract classes, config, provider arm, capability line, route `POST /admin/assistant/rewrite` (`throttle:30,1,assistant-rewrite`, any authenticated user) pointing at `AssistantController@rewrite` that for now calls `$textModel->rewrite(...)` and maps `TextModelUnavailable` ⇒ 503. Env plumbing in both compose files (`ANTHROPIC_API_KEY`, `ASSISTANT_TEXT_MODEL_DRIVER: ${…:-none}`, `ASSISTANT_TEXT_MODEL: ${…:-claude-opus-5-5}`), `.env.example`, deployment table rows.
- [ ] **Step 4: Run** — Assistant filter PASS; `docker compose config` shows the three vars.
- [ ] **Step 5: Commit** `feat(api): add the assistant text-model contract and rewrite capability`.

---

### Task 2: `AnthropicTextModel` on the official SDK

**Files:**
- Create: `api/app/Assistant/Text/AnthropicTextModel.php`
- Modify: `AssistantServiceProvider.php` (the `anthropic` arm)
- Test: `api/tests/Unit/AnthropicTextModelTest.php`

**Interfaces:**
- `new AnthropicTextModel(\Anthropic\Client $client, string $modelId)`; `rewrite()` builds the request from `RewritePrompt::build()` (Task 3 — stub it with the request's text until then), calls `$client->beta->messages->create(model:, maxTokens: 16000, outputConfig: ['effort' => 'medium'], betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system:, messages: [['role' => 'user', 'content' => $user]])`, returns the first `text` block. `stop_reason === 'refusal'` ⇒ `TextModelUnavailable('The model declined this text.')`; `'max_tokens'` ⇒ `('The rewrite came out too long — try shorter.')`; SDK `RateLimitError` ⇒ `('The assistant is busy — try again in a minute.')`; `AuthenticationError` ⇒ `('The assistant rejected the API key.')`; any other `APIError`/connection ⇒ `('Rewrite failed — try again.')`. All logged with the SDK message.
- `structured($system, $user, $schema, $model)`: same call plus `outputConfig: ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => $schema]]` (confirm the exact PHP key path in the SDK's examples before writing), `json_decode` of the text block; invalid JSON ⇒ `TextModelUnavailable`.

- [ ] **Step 1: Failing tests** — stub the client (the SDK's `Client` is constructed with a mocked transport, or wrap the one call in a tiny `ClaudeMessages` interface the driver takes — builder's choice; the test must not need network): asserts model id from config, `maxTokens` 16000, effort medium, the fallback beta + `fallbacks: 'default'`, text returned; refusal ⇒ unavailable; max_tokens ⇒ unavailable; rate-limit ⇒ the busy message; `structured()` decodes JSON and sends the schema.
- [ ] **Step 2: Run** — FAIL (class missing).
- [ ] **Step 3: Implement** the driver and bind it.
- [ ] **Step 4: Run** — PASS; full backend suite via the mount loop.
- [ ] **Step 5: Commit** `feat(api): call Claude through the official SDK for the assistant`.

---

### Task 3: Modes, prompt, result cleaning, style examples

**Files:**
- Create: `api/app/Assistant/Text/RewriteMode.php` (backed enum: `flow, punchier, shorter, longer, press`, with `instruction(): string`), `RewritePrompt.php`, `RewriteResult.php`, `StyleExamples.php`
- Test: `api/tests/Unit/RewritePromptTest.php`, `api/tests/Unit/RewriteResultTest.php`, `api/tests/Feature/StyleExamplesTest.php`

**Interfaces:**
```php
final class RewritePrompt { /** @return array{system:string,user:string} */ public static function build(RewriteRequest $r): array; }
final class RewriteResult { public static function clean(string $raw): string; public static function isUnsafeHtml(string $html): bool; }
final class StyleExamples { /** @return string[] up to 4, each ≤1500 chars, newest first */ public static function for(string $fieldKey, string $locale, string $exclude): array; }
```
- `build()`: system = the fixed rules (same language — named via `Locales::all()` `name` for `$r->locale`; facts verbatim; html tags untouched; no markdown/quotes/preamble; "no longer than {maxLength} characters"); user = `Mode: {instruction}` + `<example>` blocks + `<text>` block.
- `StyleExamples` map per spec table; `#…` suffix stripped; unknown key ⇒ `[]`.

- [ ] **Step 1: Failing tests** — prompt: contains the language name, the facts rule, the maxLength, every example fenced, the text fenced, html rule only for html; `clean()`: strips surrounding quotes, a `Here is…:` first line, trims; `isUnsafeHtml` on `<script`, `javascript:`, `onclick=`; examples: factories for Concert/Post/PostBlock/Release/BandProfile/Faq/WebsiteModule — returns ≤4 newest non-empty of the locale, excludes `$exclude`, truncates at 1500, unknown key `[]`, `post.block.text#abc` works, `profile.bio_short` returns the other bios.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api): rewrite modes, prompt and style examples for the assistant`.

---

### Task 4: The rewrite endpoint

**Files:**
- Create: `api/app/Http/Requests/RewriteRequest.php` (Form Request — name it `RewriteFormRequest` to avoid the DTO clash), `api/tests/Support/FakeTextModel.php`
- Modify: `AssistantController.php`, `api/tests/Feature/AssistantRewriteTest.php`

**Interfaces:**
- Body `{ text, format, locale, mode, fieldKey, maxLength? }` → `RewriteRequest` DTO with `examples = StyleExamples::for(fieldKey, locale, text)` and `maxLength = min(maxLength ?? 20000, 20000)`; response `{ data: { text, mode, provider, model } }`.
- `FakeTextModel` records the last `RewriteRequest`, returns `"[{$mode}] {$text}"` by default, can be told to return a given string or throw.

- [ ] **Step 1: Failing tests** — bind `FakeTextModel` in `beforeEach` (`app()->instance(TextModel::class, …)`, `config(['assistant.text_model' => 'anthropic'])`): happy path per mode (dataset over `RewriteMode::cases()`); examples reach the model (seed two concerts, rewrite `concert.description`, assert `examples` count 1 — the current text excluded); html: fake returns `<p>x <a href="/y" target="_blank">z</a></p>` ⇒ returned intact; fake returns `<script>` ⇒ 503; fake returns 2001 chars with `maxLength: 2000` ⇒ 503 "too long"; `clean()` applied (fake returns `"\"[flow] x\""` ⇒ `[flow] x`); 422 dataset (blank, over cap, bad locale/mode/format, maxLength 0); 401 anonymous; throttle key; capability true under the fake.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — Assistant filter + full suite PASS.
- [ ] **Step 5: Commit** `feat(api): rewrite admin text through the assistant endpoint`.

---

### Task 5: Frontend API layer, modes mirror, undo rule

**Files:**
- Create: `app/src/utils/rewriteModes.ts` + `.spec.ts`, `app/src/utils/enhanceUndo.ts` + `.spec.ts`
- Modify: `app/src/types/assistant.ts`, `app/src/api/assistant.ts`, `app/src/composables/useAssistant.ts` (add `useEnhance`), `app/src/i18n/{en,pl}/common.ts`, `app/scripts/lib/ratchet.mjs` (if a new file translates)

**Interfaces:**
```ts
export const REWRITE_MODES = ['flow','punchier','shorter','longer','press'] as const; export type RewriteMode = typeof REWRITE_MODES[number]
export function rewriteText(token, body: { text, format, locale, mode, fieldKey, maxLength? }): Promise<{ text: string; mode: RewriteMode }>
export function useEnhance(): { rewrite: (body) => Promise<string>, isPending: (key: string) => boolean }   // key `rewrite:<fieldKey>.<locale>`, same module-level pending set, toasts failures
// enhanceUndo.ts — pure
export interface UndoState { before: string; after: string }
export function snapshot(before: string, after: string): UndoState
export function canRestore(state: UndoState | null, current: string): boolean   // only while current === after
```
- i18n: `common.assistant.enhance`, `enhanceModes.{flow,punchier,shorter,longer,press}` (label + `…Hint`), `undo`, `rewriteFailed`.

- [ ] **Step 1: Failing specs** — `rewriteModes.spec.ts` reads `api/app/Assistant/Text/RewriteMode.php` (like `contactCodes.spec.ts`) and asserts the case values equal `REWRITE_MODES`, and both catalogues hold a label and hint per mode; `enhanceUndo.spec.ts`: restore allowed only while the row still shows `after`; a second snapshot replaces the first (Review Focus 5).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — vitest + `pnpm build`.
- [ ] **Step 5: Commit** `feat(admin): add the assistant rewrite API layer and mode registry`.

---

### Task 6: `EnhanceMenu.vue` and the `TranslatedField` integration

**Files:**
- Create: `app/src/components/admin/forms/EnhanceMenu.vue`
- Modify: `app/src/components/admin/forms/TranslatedField.vue`, `app/src/components/admin/forms/ConcertForm.vue` (+ any form whose textarea/rich field passes no `maxlength` — set it to the API's cap: concert description 2000, release description per its rule, bios per column, module copy 2000, FAQ answer 4000 is already there), `app/scripts/lib/ratchet.mjs`

**Interfaces:**
- `EnhanceMenu` props `{ disabled: boolean }`, emits `pick: [RewriteMode]`; renders the ✦ button (`.trans-enhance[data-locale]`), a popover `role="menu"` with five `role="menuitem"` buttons (`data-mode`), Escape closes, focus returns to the button.
- `TranslatedField`: on `kind !== 'input'` rows with `isFilled(modelValue[l])` and `capabilities.rewrite`, render `EnhanceMenu`; on pick: `sent = { target: modelValue[l] }`, call `rewrite({ text, format, locale: l, mode, fieldKey (uid suffix kept — the server strips it), maxLength: props.maxlength })`; on reply, if `modelValue[l] === sent.target` ⇒ `set(l, text)` and `undo[l] = snapshot(sent.target, text)`, else the "skipped — changed" toast; an **Undo** chip (`.trans-undo[data-locale]`) shows while `canRestore(undo[l], modelValue[l])`; click restores and clears.
- DOM contract for E2E: `.trans-enhance[data-locale]`, `[role=menu] [data-mode=…]`, `.trans-undo[data-locale]`, pending ⇒ the enhance button `disabled`.

- [ ] **Step 1: Failing E2E** — write `app/e2e/tests/admin/assistant-enhance.spec.ts` on the concert description (routes: capabilities `{translate:false, rewrite:true}`; rewrite echoes `[<mode>] <text>`): menu opens and lists five modes; picking `punchier` replaces the text; Undo restores; no control when `rewrite:false`; no control on an empty row; 503 toasts and leaves the row; with a 1500 ms delayed route, typing after the pick keeps the typed text and shows the "changed" toast.
- [ ] **Step 2: Run** — FAIL (`.trans-enhance` absent).
- [ ] **Step 3: Implement** both components; add `:maxlength` where missing.
- [ ] **Step 4: Run** — the new spec + `assistant-translate.spec.ts` + `concerts.spec.ts` + `releases.spec.ts` + `faqs.spec.ts`; `pnpm build`; vitest.
- [ ] **Step 5: Commit** `feat(admin): add the Enhance menu to translated text fields`.

---

### Task 7: Docs

- CLAUDE.md (assistant section: the second method on `TextModel`, the length contract, the "no cache" note, `FakeTextModel` for tests), `app/CLAUDE.md` (Enhance in the TranslatedField paragraph), CHANGELOG entry (Added: Enhance menu; how to switch on: `ASSISTANT_TEXT_MODEL_DRIVER=anthropic` + `ANTHROPIC_API_KEY`).
- Commit `docs: document the assistant Enhance layer`.

## Self-review notes

- Spec coverage: contract/capability/env → T1; driver + fallbacks + error map → T2; modes/prompt/clean/examples + exclusion rule → T3; endpoint + maxLength contract + html safety → T4; mirror spec in Vitest + undo rule → T5; menu, undo chip, late-reply drop, maxlength on forms → T6; docs → T7. `structured()` implemented in T2 and tested, unused until phase 3.
- Review Focus pins: 1→T3 prompt test + T4 echo; 2→T4; 3→T6 E2E; 4→T2; 5→T5.
