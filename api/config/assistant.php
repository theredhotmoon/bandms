<?php

/*
|--------------------------------------------------------------------------
| Admin assistant
|--------------------------------------------------------------------------
|
| Which provider stands behind each assistant capability. The admin reads
| GET /api/admin/assistant/capabilities and renders a control ONLY for a
| capability the server reports, so an unconfigured provider means no
| button — never a disabled one.
|
| `translator`: 'deepl' | 'none'. `text_model`: 'anthropic' | 'none'. Unset
| means none, in production too: a key on its own switches nothing on. Keys
| live in config/services.php like every other third-party credential.
|
*/
return [

    'translator' => env('ASSISTANT_TRANSLATOR', 'none'),

    // Per request, per item. The admin sends one request per form field, so a
    // request rarely holds more than the field's empty locales.
    'max_items' => 50,
    'max_chars' => 20000,

    // A translated sentence is cached by its text, so re-translating the same
    // string costs no quota — dev and E2E pointed at a real key included.
    'cache_ttl_days' => 30,

    // ── Enhance / triage (App\Assistant\Text) ───────────────────────────────
    // Model ids are config, never literals in code. Enhance rewrites in the
    // band's voice; triage (phase 3) classifies and may use a cheaper model.
    'text_model'       => env('ASSISTANT_TEXT_MODEL_DRIVER', 'none'),
    'text_model_id'    => env('ASSISTANT_TEXT_MODEL', 'claude-opus-5-5'),
    'triage_model_id'  => env('ASSISTANT_TRIAGE_MODEL', 'claude-haiku-5-5'),
    'rewrite_max_chars' => 20000,

    // ── The crawler (phase 3) ───────────────────────────────────────────────
    // Whether this stack's scheduler runs the nightly crawl. The dev stack
    // turns it off: dev and prod keep separate run ledgers, so a real key in
    // both would spend each provider's daily cap twice. `assistant:crawl`
    // by hand still works.
    'crawler_scheduled' => (bool) env('ASSISTANT_CRAWL_SCHEDULED', true),

];
