<?php

/**
 * The locale registry — the single place that knows which languages exist.
 *
 * Adding a language means adding a key here, not grepping for 'pl'. Everything
 * server-side reads this file: the SetLocale middleware, every Resource that
 * flattens a translation bag to one string, the admin write validation, and the
 * `locales` block on GET /api/site-config that the public site builds its
 * language switcher and hreflang alternates from.
 *
 * `fallbacks` is the whole fallback policy, stated per locale.
 * ------------------------------------------------------------------
 * Resolution walks [locale, ...fallbacks] and stops at the first non-empty
 * value. There is deliberately no "then try every other locale" tail: with two
 * locales that tail is invisible, but at three it starts showing a German
 * visitor Polish text.
 *
 * en <-> pl fall back to each other, which is a deliberate choice for THIS pair
 * and is not a template for new locales. The reasoning (see FaqSummaryResource)
 * is that a half-translated FAQ should show the language it has rather than
 * render an empty accordion row in a green Astro build. A third locale should
 * normally declare ['en'] alone.
 *
 * NOTE: config is baked by `php artisan optimize` in the container entrypoint.
 * Editing this file needs a container rebuild, not a restart.
 */
return [

    'default' => 'en',

    'supported' => [

        'en' => [
            'name'        => 'English',
            'native_name' => 'English',
            'html_lang'   => 'en',
            'date_locale' => 'en-GB',
            'fallbacks'   => ['pl'],
        ],

        'pl' => [
            'name'        => 'Polish',
            'native_name' => 'Polski',
            'html_lang'   => 'pl',
            'date_locale' => 'pl-PL',
            'fallbacks'   => ['en'],
        ],

    ],

];
