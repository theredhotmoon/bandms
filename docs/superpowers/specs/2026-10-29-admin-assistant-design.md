# Admin assistant — design

**Date:** 2026-10-29 · **Status:** draft, awaiting approval · **Branch:** `feature/assistant-translate`

The band wants the admin panel to help with the writing and the looking-around
that currently costs them evenings: translating what they wrote into the other
site language, tidying the flow of a paragraph, and noticing when the internet
talks about them or a venue they should be talking to. This document is the
umbrella design for that "assistant", and the detailed design for its first
phase. Phases 2 and 3 get their own detailed design when phase 1 has shipped —
each depends on what the earlier one taught us.

## Intent and why

Skanking Storks write in Polish first and publish in Polish and English
(`content_locale_order`); every concert, release, post and page-copy field is a
translation bag the band fills twice by hand. Machine translation of that bag is
essentially free at this volume and good enough for European languages to be a
first draft the band edits rather than writes. The same button-beside-a-field
shape serves a second need — rewriting a paragraph for flow in the band's own
voice — and the same text-model layer serves a third: turning a nightly pile of
web/social/venue data into a short list of things worth a human's attention.

**Why now:** the translated-slug series (#150–#155) and the content-language
order work (#194) finished moving every translated field onto one
`{en, pl}` bag shape and one ordering source. That is what makes a single
shared component — and therefore a single place for a Translate button —
possible for the first time.

## Goals, non-goals, anti-goals

**Goals (programme)**

1. One click fills the other language(s) of any translated field or whole form.
2. One click rewrites a textarea/rich-text field for flow, in that field's
   language, in the style of what the band already wrote in that field type.
3. A scheduled job gathers mentions of the band and candidate venues/promoters
   from sources that permit it, triages them, and shows them in the admin.
4. The *model behind* each of these is a swappable provider. The band may
   choose cost, quality or "data stays on our server" per capability without a
   code change.

**Non-goals**

- Translating the admin's own UI chrome — `useUiLang()` already does that.
- Auto-publishing anything. Every assistant output lands in a form field or an
  inbox the band reviews; nothing reaches the public site without Save.
- Fine-tuning a model on the band's text. Few-shot examples from the database
  are enough for "write like us" at this scale.
- A chat window. The assistant is buttons and a feed, not a conversation.

**Anti-goals (what would make this a failure even if it works)**

- **Overwriting something the band typed.** A translate/enhance action may fill
  an empty field freely; replacing a non-empty one is always a distinct,
  deliberate act.
- **Buttons that exist but do nothing.** If no provider is configured, the
  buttons are not rendered, not greyed out — a disabled control that nobody can
  enable from the UI is a control pretending to be one (the `ALWAYS_ON_MODULES`
  rule, applied here).
- **Scraping Facebook Groups or Instagram.** Meta withdrew group content from
  the Graph API in 2023; every tool that still offers it scrapes in breach of
  Meta's terms and risks the band's own page. Phase 3 reads only official APIs
  and sources that publish feeds. See *Phase 3* for the list.
- **Breaking the forms to add the buttons.** Phase 1 migrates ~12 hand-rolled
  `.trans-row` blocks onto one component. Each migrated form must behave
  identically before its button appears.

## Constraints

- **Server:** Hetzner CX22 (2 vCPU / 4 GB), shared with the `epr-*` projects.
  No local model runs there; the band is open to upgrading, but phase 1 and 2
  must work without that. Decision on local vs hosted models is phase 2's.
- **Keys and config** follow the existing pattern: env → `config/services.php`
  → `config('services.<provider>.*')`, declared in both compose files
  (CLAUDE.md, *Setting a backend env var in `.env` alone does nothing*). Keys
  never live in `site_settings`.
- **No scheduler exists.** `queue:work` runs under supervisord in the backend
  container; `schedule:work` does not. Phase 3 adds it. Phases 1–2 are
  request/response only and need neither.
- **CI runs no real provider.** Pest fakes `Http`; Playwright intercepts the
  assistant endpoints with `page.route`. A test that reaches DeepL is a bug.
- **Locale registry.** No `'en'`/`'pl'` literal outside the three registry
  files. Source and target locales come from `useContentLocales()` / `App\Support\ContentLocales`.
- **Admin conventions** (`app/CLAUDE.md`): api file → composable → component;
  utils for anything unit-tested; `.spec.ts`; i18n guards (no literal English
  in templates; `i18n-ignore` goes on a const in script, never inside a tag).

## Architecture — the two provider layers

```
app/  TranslatedField.vue ──► useAssistant() ──► src/api/assistant.ts
                                                       │
api/  POST /api/admin/assistant/translate ─► App\Assistant\Translation\Translator (interface)
                                                 ├── DeepLTranslator          (phase 1, default)
                                                 ├── GoogleTranslator         (phase 1)
                                                 └── NullTranslator           (unconfigured → capability off)
      POST /api/admin/assistant/rewrite   ─► App\Assistant\Text\TextModel      (interface, phase 2)
                                                 ├── hosted API driver(s)
                                                 └── OllamaTextModel
      GET  /api/admin/assistant/capabilities ─► {translate: bool, rewrite: bool, …}
```

**Two interfaces, not one**, because machine translation and text generation
have different best providers at different prices: DeepL/Google translate
better and cheaper than any LLM at this volume; an LLM rewrites and
summarises, which MT cannot. Phase 3 reuses `TextModel` for triage and never
calls `Translator`.

`capabilities` is read once per admin session (`useAssistantCapabilities`,
TanStack Query, long `staleTime`) and is what hides a button whose provider is
unconfigured. It is the only endpoint that may answer when nothing is set up.

Config selects the driver: `ASSISTANT_TRANSLATOR=deepl|google|none` with
`DEEPL_API_KEY` / `GOOGLE_TRANSLATE_API_KEY`. `AssistantServiceProvider` binds
`Translator` to the chosen driver, or `NullTranslator` when the key for the
chosen driver is absent. **Unset means `none`**, so a fresh checkout and CI
have no capability and render no buttons.

---

## Phase 1 — Translate (this branch)

### What the band sees

On every form with translated fields, each locale row of a translated input,
textarea or rich editor gains a small button at its right edge: a ↔ icon with
the tooltip *"Translate from EN"* — naming the **source**, which is the first
*filled* locale in content order that is not this row. Pressing it fills that
row from that source. While it runs the button shows a spinner; the field
stays editable.

**Source = first filled locale in content order, not "the primary"** (my
call, from the builder check). The band's backlog is the opposite shape to
the one a primary-only rule serves: records written in English before the
order was switched to Polish-first, where PL is the empty row. A primary-only
rule would hide the button on exactly those rows. So the primary row carries
a button too whenever another locale has text; the tooltip always names the
language it will read from.

- **Target empty:** fills it. No confirmation.
- **Target non-empty:** the button reads *"Replace with translation"* on
  hover and needs a second press within 3 s (the first press turns it into a
  confirm state). This is the anti-goal above, made concrete.
- **No other locale filled:** button hidden for that field — nothing to
  translate from.
- **Failure:** the existing toast pattern, with the server's message
  (`"Translation unavailable — DeepL quota reached"` etc.). Field untouched.

At the top of each form's translated section (next to where the slug input
sits today) a **"Translate empty fields"** button fills every empty locale of
every translated field on the form, each from that field's own source locale.
It never touches a non-empty field. Hidden when `capabilities.translate` is
false or nothing is empty.

It is a thin wrapper over the per-field path: **one request per field, issued
in parallel**, so each row shows its own spinner, a slow or failed field
leaves the others filled, and no request ever nears the item cap (my call,
from the builder check — the alternative, one all-or-nothing request, could
run 30 s behind PHP-FPM and had no shape for "40 of 50 succeeded"). Phase 1
offers it on forms whose translated content is a flat set of bags — Concert,
Release, Tag, Clip, Instrument, each FAQ row, each module's copy group.
**PostForm's block body gets per-field buttons only** in phase 1; a
form-level fill across an array of blocks is a follow-up.

Rich text (Tiptap HTML) translates as HTML — tags are preserved, text nodes
translated. Plain fields translate as text.

Nothing is saved by translating; the form's Save does what it always did.

### Component: `TranslatedField.vue`

Replaces the hand-rolled `.trans-row` blocks. Props:

| Prop | Type | Notes |
|---|---|---|
| `modelValue` | `TranslationBag` | `v-model` |
| `kind` | `'input' \| 'textarea' \| 'rich'` | which control each row renders |
| `label` | `string` | field label (already i18n'd by caller) |
| `placeholders` | `Partial<Record<Lang,string>>` | per-locale placeholder |
| `errors` | `Partial<Record<Lang,string>>` | from the 422 bag, keyed by locale |
| `required` | `boolean` | marks only the primary locale's control `required` (the content-language rule) |
| `locales` | `Lang[]` | optional override; default `useContentLocales().order`, honouring `inject(VISIBLE_LOCALES)` the way the block editors already do |
| `rows`, `maxlength` | passthrough | |
| `format` | `'text' \| 'html'` | default derived from `kind` (`rich` → html) |
| `fieldKey` | `string` | a stable identifier like `concert.description`; phase 2 uses it to pick style examples — add now so forms do not need touching twice |

Emits `update:modelValue`. The badge, `trans-row` / `trans-row--top` layout
and `lang-badge--<l>` classes move into the component (and out of
`form-styles.css`, ConcertForm's and ReleaseForm's private copies) once the
last form has migrated. `data-locale="<l>"` stays on each row — E2E selects by
it, and the `.first()` locale-order trap from #194 means specs must keep
targeting by locale, never by position.

The translate button is rendered by `TranslatedField` itself, from
`useAssistantCapabilities()`; forms do not know it exists. "Translate empty
fields" is a separate small component, `TranslateFormButton.vue`, that takes
the form's bags as `fields: Record<string, TranslationBag>` and a `format` per
key, and emits `filled` with the merged bags.

**Migration order** (one PR each where the form is large; several small forms
per PR otherwise): component + ConcertForm → PostForm (incl. `visibleLocales`
→ `locales` prop) → ReleaseForm → TagForm, ClipForm, InstrumentForm →
FaqEditor (its rows gain `data-locale`) → WebsiteModulesView → block editors
(Text/Image/Embed) → BandProfileAdminView. The last one uses language **tabs**
rather than stacked rows; it keeps the tabs and mounts the button in the
active tab's toolbar — my call, and the one most likely to need design
iteration, so it goes last.

**WebsiteModulesView is the one form not on the bag shape.** Its
`draftSettings` is a flat `Record<string,string>` keyed `${field.key}.${locale}`,
it still holds `en:`/`pl:` literals (~line 208) and renders badges with
`locale.toUpperCase()` instead of `shortLabel`. Migrating it means reshaping
that draft into `Record<fieldKey, TranslationBag>` and converting at the API
boundary — a real refactor inside the migration, which is why it sits late in
the order and gets its own PR.

### Slug regenerate button — close the gap first

Audit (2026-10-29): all six slug consumers already share `TranslatedSlugInput`,
and its ↻ *regenerate* button renders per locale only when the form passes
`sources[l]`. **Merch items (`ShopItemForm`) and photo albums
(`BatchPhotoUpload`) pass `{ [DEFAULT_LOCALE]: name }`** because their name is
one untranslated string, so the non-default slug row has no button there — a
deliberate choice ("typed by hand") that the band has now overruled: an
untranslated name is still the right source for every locale's slug.

Fix, as the first slice of this phase because `TranslatedField` will sit
beside it: `TranslatedSlugInput` gains `source?: string` — one untranslated
source that applies to every locale, mutually exclusive with `sources`. The
two forms switch to it; the "typed by hand" comments go. E2E
(`shop.spec.ts`, the albums spec) asserts a regenerate button on **each**
`[data-locale]` slug row, so the next form with a single-string name cannot
regress it. Server side is unchanged: a regenerated non-default slug is sent
as an explicit value, which `applySlugBag()` already accepts and suffixes.

### API

```
POST /api/admin/assistant/translate
  auth:api · throttle:60,1,assistant-translate
  body: { items: [{ key: string, text: string, format: 'text'|'html',
                    source: Lang, target: Lang }] }
  200:  { data: { items: [{ key, text }], provider: 'deepl'|'google' } }
  422:  validation (unknown locale, source === target, >50 items, item > 20 000 chars)
  503:  { message } when no provider is configured or the provider refuses
        (quota, auth) — message is user-facing and already in the UI language
        where the server knows it, otherwise English

GET /api/admin/assistant/capabilities
  auth:api
  200:  { data: { translate: bool, rewrite: false } }
```

`source`/`target` sit on each item so one field's empty locales — possibly
with different sources — travel in one request. A request is all-or-nothing;
partial success is the client's concern (one request per field, above).
Locale validation uses `Locales::codes()`.

**Provider language codes come from the registry, not the driver.** DeepL
wants `EN-GB`/`EN-US` as a target and deprecates bare `EN`; Google takes
`en`. A `['en' => 'EN-GB']` map inside the driver would be an `'en'` literal
outside the three registry files, so `api/config/locales.php` gains one
server-only key per locale — `translation: ['deepl' => 'EN-GB', 'google' => 'en']`
— read through a new `Locales::translationCode($locale, $provider)`. The two
TypeScript mirrors do not carry it: they never call a provider, and the
"three files agree" rule is about *which locales exist*, not every attribute.
**The English variant is the band's decision** (open question below); the
`date_locale` of `en-GB` argues for British, and a later switch re-spends
quota and loses edits, so it is settled once, now.

**Driver scope:** DeepL ships in phase 1. `GoogleTranslator` is designed in
(the interface, the registry code, the `ASSISTANT_TRANSLATOR` switch); whether
it is *built* in phase 1 or as a follow-up PR is the band's call (open question
below) — it roughly doubles the backend test surface.

`AssistantTranslateController` is thin: validate → `Translator::translate(items,
source, target)` → resource. The drivers:

- `DeepLTranslator`: `POST https://api-free.deepl.com/v2/translate` (or
  `api.deepl.com` when the key does not end in `:fx`, which is how DeepL
  marks free keys), `tag_handling=html` for html items, `Http::timeout(15)`,
  retries once on 429/5xx. Maps `456` (quota) and `403` to a 503 with a
  distinct message.
- `GoogleTranslator`: `POST https://translation.googleapis.com/language/translate/v2`
  with `format=html|text`, API-key auth. Same error mapping.
- `NullTranslator::translate()` throws `TranslatorUnavailable` — the
  controller turns that into the 503; `capabilities` reports false.

**Cache:** `Cache::remember(sha1(provider|source|target|format|text), 30 days)`
per item. Re-translating the same sentence is free, and it keeps E2E and
local dev from spending quota when they *are* pointed at a real key.

**Usage log:** one `Log::info('assistant.translate', [...chars, provider])`
line per request. A usage table is phase 2+'s concern; not needed to ship.

### Config

`config/services.php` gains `deepl.api_key` and `google_translate.api_key`;
new `config/assistant.php` carries `translator` (driver name) and the per-item
and per-request caps. Both compose files add `ASSISTANT_TRANSLATOR`,
`DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY` to the `backend` service's
`environment:` block; `.env.example` documents them with `none` as the
default. `docs/deployment.md` §6 (the secrets table) gets three rows.
**Unset means `none` in production too** — a key alone never switches the
feature on; the driver name does.

### Tests

| Layer | What |
|---|---|
| Pest | `AssistantTranslateTest`: happy path with `Http::fake()` for each driver; html passthrough; cache hit makes no second HTTP call; 422 on bad locale/same locale/oversize; 503 and `capabilities.translate=false` when unconfigured; 401 anonymous; throttle key present |
| Vitest | `src/utils/translationFill.spec.ts` — the pure "merge translated items into bags, never over non-empty" function behind *Translate empty fields* |
| Vitest | `TranslatedField.spec.ts` renders rows per locale, marks only primary required, hides the button when capability false / primary empty |
| Playwright (admin) | `e2e/tests/admin/assistant-translate.spec.ts`: `page.route` the two endpoints; per-field fill; replace needs the second press; form-level fill skips a non-empty field; buttons absent when capabilities says false |
| Playwright (existing) | every migrated form's existing spec stays green — that is the migration's acceptance test |

### Phase 1 — what is left to the builder

- Exact icon and the confirm-state styling (follow `form-styles.css` button
  patterns; no new colours).
- Whether `TranslateFormButton` lives inside `TranslatedSlugInput`'s section
  or above the first translated field — whichever the form's layout already
  suggests.
- How the i18n catalogue keys for the new strings are named (follow the
  existing `admin.*` namespaces).

---

## Phase 2 — Enhance (sketch; detailed design after phase 1 ships)

- `TextModel` interface: `rewrite(text, locale, examples[], format)`.
  `POST /api/admin/assistant/rewrite`. Capability `rewrite`.
- Button sits beside the translate button on `kind: textarea | rich` rows,
  **for every locale including the primary**; the result replaces the field
  through the same confirm-state rule, with the previous text kept in
  component state for a one-shot *Undo* until the next edit.
- "Write like us": `fieldKey` + locale select the last 3–5 non-empty values
  of the same field across records (`concert.description` → other concerts'
  `description.<locale>`) as few-shot examples. A server-side
  `StyleExamples` resolver maps `fieldKey` to a model+column; unknown keys
  mean no examples, never an error.
- **Provider decision is open and is the band's:** hosted API (pennies/month,
  best Polish, 2–5 s, text leaves the server) versus Ollama on an upgraded
  Hetzner (≈€20/mo CX42-class for a 4B model at 20–40 s per paragraph with
  unproven Polish quality; ≈€232/mo GEX44 for a GPU). Recommended first step
  is a **spike**: Ollama on the dev machine, `gemma`/`qwen` 4B, five real
  Polish descriptions, judged by the band. Design follows the spike.

## Phase 3 — Robot (sketch; detailed design after phase 2)

- Adds `schedule:work` to supervisord; jobs per source into `mentions` and
  `leads` tables; an *Assistant* widget on the dashboard and a weekly digest
  mail; settings UI for keywords, regions and source toggles (first real
  settings page — `SiteSetting` keys, not env).
- **Sources, all official or feed-based:** Meta Graph API for mentions/tags
  of the band's *own* IG account and FB page (credentials exist); Google
  Alerts RSS and/or Programmable Search API; YouTube Data API search (key
  exists); setlist.fm (key exists) for sibling-band venues; Reddit, Last.fm,
  Bandcamp feeds; Google Places Text Search and OSM Overpass for venue
  discovery. Optionally Brand24's API as a paid public-FB/IG-page feed.
  **Explicitly excluded:** Facebook Groups, arbitrary IG/FB scraping,
  Bandsintown/Songkick (partner-only).
- AI (`TextModel`) does triage only: dedupe against `venues`/`bands`/`authors`,
  "about us / not us" classification, weekly summary, outreach draft. Fetching
  is deterministic.
- Leads promote into the existing `Venue` / `Band` / `Author` rows with one
  click; those tables gain `source` and `lead_status`.

## Open questions for the band (phase 1 only)

1. **British or American English** as the translation target? Decides the
   `deepl` code in the registry (`EN-GB` vs `EN-US`). Recommendation: GB,
   matching the site's `en-GB` date locale.
2. **DeepL only in phase 1, Google as a later PR?** Recommendation: yes.
   DeepL's free tier covers the site many times over; a second driver is a
   day of work and tests that can wait until there is a reason to compare.

## Calls made during the builder check (for the band to glance at)

- Source locale is the first *filled* locale in content order, not the
  primary — so EN-only legacy records get a PL button.
- Form-level fill is parallel per-field requests, partial success allowed;
  not offered across PostForm's block array in phase 1.
- Provider language codes live in `api/config/locales.php` (server only).
- The 50-item cap stays; the per-field request shape makes it unreachable.
- Translate buttons appear on content forms only, not mail composition.
