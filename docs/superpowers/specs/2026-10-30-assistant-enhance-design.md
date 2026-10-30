# Admin assistant, phase 2 — Enhance

**Date:** 2026-10-30 · **Status:** draft, awaiting approval · **Umbrella:** `2026-10-29-admin-assistant-design.md` (phase 1 shipped as #222/#225)

## Intent and why

Every translated textarea and rich field in the admin now carries a Translate
button. The band's second ask is the same shape with a different verb: a
button that rewrites a paragraph — tidier flow, punchier, shorter, longer, or
press-formal — in the language it is written in and in the band's own voice,
learned from what they already wrote in that field. The band said the text may
leave the server, which makes this a hosted-model feature with no hardware
question attached.

## Goals, non-goals, anti-goals

**Goals**

1. An *Enhance* control on every `textarea` and `rich` row of `TranslatedField`
   (every locale, primary included), offering five modes.
2. The rewrite sounds like the band: the prompt carries a few of their own
   recent texts of the same field type and language as examples.
3. The model behind it is a swappable provider with a capability flag, exactly
   like `Translator`: unset means the control is not rendered.
4. Nothing is saved by enhancing; the row shows the result, the band can undo
   it, and Save is what it always was.

**Non-goals**

- A chat window, free-form instructions, or a custom-prompt box.
- Generating text from nothing (an empty field has no Enhance control).
- Fine-tuning. Few-shot examples from the database are the whole "voice".
- Rewriting single-line `input` fields (titles, names). Names are facts.

**Anti-goals**

- **Changing facts.** Dates, venue names, prices, URLs, band and person names
  must survive every mode verbatim. The prompt says so; the tests pin it with
  a fake model, and the *facts* line is the first thing a reviewer of the
  prompt should read.
- **Silently replacing the band's text.** Enhance always replaces the row (that
  is its point), so it always leaves an **Undo** behind until the next edit.
- **A control that exists but does nothing.** Same rule as Translate.
- **Markdown or commentary in the result.** The model returns the text and
  nothing else; a preamble ("Here's a punchier version:") is a failure the
  server strips or rejects, never something the band sees in their field.

## Constraints

- Backend is Laravel 11 / PHP 8.2+; the call goes through the official
  `anthropic-ai/sdk` composer package (never raw HTTP, never an
  OpenAI-compatible shim). Key via `ANTHROPIC_API_KEY`, declared in both
  compose files like `DEEPL_API_KEY`.
- Model id is config, never a literal in code: `ASSISTANT_TEXT_MODEL`,
  default `claude-opus-5-5` (the current default model; the band may set
  `claude-sonnet-5-5` to cut cost ~2×). Thinking is left at the model's
  default (adaptive); `outputConfig: ['effort' => 'medium']` set explicitly.
  Server-side refusal fallback on by default (`betas:
  ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`) — a declined
  rewrite is re-run on a fallback model inside the same call; a final
  `stop_reason === 'refusal'` becomes a 503 with a message.
- CI never calls Anthropic: the driver is tested through a fake `TextModel`
  binding, the prompt builder through a unit test, the admin through
  `page.route`.
- Registry rule unchanged (no locale literals outside the three files); the
  prompt names the language through `Locales::all()` metadata (`name`), not a
  literal.

## Architecture

```
TranslatedField.vue ─► EnhanceMenu.vue ─► useEnhance() ─► api/assistant.ts
                                                        │
POST /api/admin/assistant/rewrite ─► App\Assistant\Text\TextModel (interface)
                                        ├── AnthropicTextModel   (default)
                                        └── NullTextModel        (capability off)
GET  /api/admin/assistant/capabilities ─► { translate, rewrite }   (rewrite flips true)
```

`TextModel` is deliberately **not** `Translator`: machine translation stays on
DeepL (better and cheaper for that job); the text model rewrites and, in phase
3, triages. So the interface carries **two methods from day one**, so phase 3
does not change it under slices already built:

```php
interface TextModel {
    public function name(): string;                                   // 'anthropic' | 'none'
    public function rewrite(RewriteRequest $r): string;               // phase 2
    /** JSON matching $schema (output_config.format json_schema), decoded. */
    public function structured(string $system, string $user, array $schema, ?string $model = null): array;  // phase 3 triage
}
```

`structured()` is implemented in phase 2 (one test with the stub client)
and first *used* in phase 3; `$model` lets triage pick a cheaper model
(`ASSISTANT_TRIAGE_MODEL`, falling back to `ASSISTANT_TEXT_MODEL`). Both hang off `AssistantServiceProvider` and `config/assistant.php`
(`text_model: env('ASSISTANT_TEXT_MODEL_DRIVER', 'none')` → `anthropic|none`;
`text_model_id: env('ASSISTANT_TEXT_MODEL', 'claude-opus-5-5')`).

### Modes

One registry, mirrored once: `App\Assistant\Text\RewriteMode` (backed enum)
and `app/src/utils/rewriteModes.ts` (the admin's list + i18n label keys).
`RewriteMode::cases()` is what validation accepts; the admin list is pinned
to it by a **Vitest** spec that reads the PHP enum file (the direction
`contactCodes.spec.ts` already uses — the Pest image holds `api/` only, so
the check cannot run the other way).

| Mode | Instruction (the prompt fragment) |
|---|---|
| `flow` | Fix grammar, rhythm and clarity. Keep meaning, facts, length (±10%) and tone. |
| `punchier` | Same facts; more energy, shorter sentences, a stronger opening. Length ±20%. |
| `shorter` | Same facts; about half the length. Drop repetition, never a fact. |
| `longer` | Same facts, more detail *from the text itself* (no invented facts); up to 2×. |
| `press` | Same facts, third person, neutral press-release register; no exclamation marks, no "we". |

### The prompt (server-owned)

`RewritePrompt::build(RewriteRequest, examples): array` returns `system`
(fixed text — a few hundred tokens, so **below the model's cacheable
minimum**: no `cacheControl`, and the cost figures below assume no cache)
and the `user` content:

- **System (fixed):** you edit short texts for a band's website; return only
  the rewritten text; same language as the input (named); preserve every fact
  — names, dates, times, places, prices, URLs, numbers — verbatim; for HTML
  input keep every tag and attribute and change only text nodes; no markdown,
  no quotes around the result, no preamble.
- **User:** `Mode: <instruction>`, then `Examples of how this band writes
  <field label> (<language>):` with up to **4** examples fenced as
  `<example>…</example>`, then `Text:` fenced as `<text>…</text>`.

**Length is a contract, not a hope.** The request carries the field's
`maxLength` (the column cap the form already knows: concert description
2 000, module copy 2 000, FAQ answer 4 000, bios per their columns; the
forms that pass no `maxlength` today gain one matching the API's rule), the
prompt states it ("no longer than N characters"), and the server rejects a
result over it with a 503 "The rewrite came out too long — try *shorter*".
`maxTokens` 16 000, non-streaming (thinking tokens count against it, and
*longer* on a long Polish text can run to ~12k); a `stop_reason` of
`max_tokens` is a 503, never a cut-off paragraph in the band's field. Input
is capped at `min(maxLength, 20 000)` chars. The response's first `text`
block is the result; it is trimmed, a leading/trailing pair of quotes or a
`Here is…:` preamble line is stripped by `RewriteResult::clean()`, and for
`html` input a result that contains `<script`, `javascript:` or an `on*=`
attribute is rejected as a 503 "Rewrite failed — try again" (the editor
never stored those; the model must not introduce them).

### Style examples — "write like us"

`StyleExamples::for(string $fieldKey, string $locale, string $exclude): array`
maps a `fieldKey` to a source and returns up to 4 most recent non-empty
values in that locale, each ≤ 1 500 chars, excluding one equal to `$exclude`
(the text being rewritten — the record's own current value):

| `fieldKey` | Source |
|---|---|
| `concert.description` | `concerts.description` translations |
| `post.intro` | `posts.intro` |
| `post.block.text` (`#uid` stripped) | `post_blocks.payload.body` of type `text` |
| `release.description` | `releases.description` |
| `profile.bio_short/medium/long/full` | the same `band_profiles` column — the other variants are the examples |
| `faq.answer` | `faqs.answer` |
| `module.<slug>.<field>` | the same `settings.<field>` on other modules (the server cannot tell which other keys are textareas — field types live only in `packages/site-copy`, TypeScript) |
| anything else | no examples (never an error) |

The map lives in one class so phase 3's "draft an outreach email like us"
reuses it. `image alt/caption`, `embed label`, `faq.question`, `tag/clip/
instrument names` are `input` kind and never get the control.

**Exclusion is by text equality, and that is good enough.** The request
names no record (a `fieldKey` is a field type, not a row), so a record's
own *stored* value can appear among the examples once the band has edited
the textarea before pressing Enhance. It is still the band's own writing of
that field; an id in the body would buy little. Decided now so phase 3 does
not reopen it.

### API

```
POST /api/admin/assistant/rewrite
  auth:api · throttle:30,1,assistant-rewrite
  body: { text, format: 'text'|'html', locale: Lang, mode: RewriteMode, fieldKey: string, maxLength?: int }
  200:  { data: { text, mode, provider: 'anthropic', model } }
  422:  blank text, text > min(maxLength, 20 000) chars, unknown locale/mode/format, fieldKey >200, maxLength outside 1..20 000
  503:  { message } — unconfigured, refusal, max_tokens stop, result over maxLength, SDK error (rate limit/auth/5xx), unsafe html
```

One request = one rewrite; no batching (there is no "enhance all"). Logged as
`assistant.rewrite` with `mode, chars_in, chars_out, model, usage` (input,
cache-read, output tokens) — the usage counters are what a cost question is
answered from.

### What the band sees

On every `textarea`/`rich` row with text, a ✦ *Enhance* button sits beside
↔ *Translate* (same `trans-control` slot, same hidden-not-disabled rule on
`capabilities.rewrite`). Clicking opens a small menu of the five modes
(labels from the catalogue; a one-line hint each). Choosing one:

- the row shows the spinner (shared `pending` set, key
  `rewrite:<fieldKey>.<locale>`; a row in a translate or a rewrite refuses a
  second request);
- on success the text is replaced and an **Undo** chip appears at the row's
  right edge, holding the previous text in component state; it stays until
  the band edits the row or presses it (restore). A reply that arrives after
  the row changed is dropped with the existing "skipped — changed" toast.
- on failure: the server's toast; the row untouched.

Nothing new on the form level, and the menu is keyboard-reachable (buttons,
Escape closes, focus returns).

### Tests

| Layer | What |
|---|---|
| Pest | `AssistantRewriteTest`: with a `FakeTextModel` bound — happy path per mode (fake echoes the mode), examples passed (fake records the request; `StyleExamplesTest` covers the map per fieldKey with factories, the exclusion, the cap of 4 and 1 500 chars, unknown key ⇒ []), html rejection on `<script>`, `clean()` strips quotes/preamble, result over `maxLength` ⇒ 503, 422 dataset, 503 when driver is `none`, capability flips, throttle key |
| Pest (driver) | `AnthropicTextModelTest`: the driver takes the SDK client through a constructor so a stub client returns a canned `Message`; asserts model id from config, effort `medium`, `maxTokens` 16 000, refusal ⇒ `TextModelUnavailable`, `max_tokens` stop ⇒ `TextModelUnavailable`, SDK rate-limit/auth exceptions mapped to distinct messages |
| Vitest | `rewriteModes.spec.ts` (list mirrors the PHP enum's cases; labels exist in both catalogues), `enhanceUndo.spec.ts` (pure: snapshot/restore/clear-on-edit rule) |
| Playwright | `assistant-enhance.spec.ts` on the concert description: menu opens/closes, a mode replaces the text (route echoes `[mode] text`), Undo restores, no control when `rewrite:false`, no control on an empty row, a 503 toasts and leaves the row, a late reply after an edit is dropped |

### Decisions from the band (2026-10-30)

1. **Default model: `claude-opus-5-5`** (a typical 1 000-char rewrite with
   four examples is ~2 500 input + ~500 output tokens ≈ $0.02, no cache
   assumed). Config value; `claude-sonnet-5-5` halves it.
2. No *translate-and-press* combo — two clicks do it.
3. Execution: native, same as phase 1; one PR.

### Left to the builder

- Icon and menu styling (follow `.trans-translate`; no new colours).
- Exact clean-up regexes in `RewriteResult::clean()`.
- Whether the SDK's typed exceptions map to three messages or two.
