<?php

/*
|--------------------------------------------------------------------------
| Admin assistant
|--------------------------------------------------------------------------
|
| Which provider stands behind each assistant capability. The admin reads
| GET /api/admin/assistant/capabilities and renders a button ONLY for a
| capability the server reports, so an unconfigured provider means no
| button — never a disabled one.
|
| `translator`: 'deepl' | 'none'. Unset means none, in production too: a
| DEEPL_API_KEY on its own switches nothing on. The key lives in
| config/services.php like every other third-party credential.
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

];
