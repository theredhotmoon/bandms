<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'youtube' => [
        'api_key' => env('YOUTUBE_API_KEY'),
    ],

    'facebook' => [
        'app_id'     => env('FACEBOOK_APP_ID'),
        'app_secret' => env('FACEBOOK_APP_SECRET'),
        'page_id'    => env('FACEBOOK_PAGE_ID'),
        // The crawler's own-page mentions (`/{page}/tagged`, IG `/tags`) need a
        // long-lived PAGE token minted by a page admin — not the app token.
        'page_access_token' => env('FACEBOOK_PAGE_ACCESS_TOKEN'),
        'instagram_user_id' => env('INSTAGRAM_USER_ID'),

        // Fan sign-in (App\Support\FanProviders) - an OAuth client of its own. Here
        // and not under a second 'facebook' key, which would replace this one. The
        // redirect reads config('newsletter'), which loads before 'services'.
        'client_id'     => env('FACEBOOK_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_CLIENT_SECRET'),
        'redirect'      => rtrim(config('newsletter.frontend_url'), '/') . '/api/fan/auth/facebook/callback',
        'guzzle'        => ['timeout' => 10, 'connect_timeout' => 10],
    ],

    // Admin assistant — the crawler. One Cloud project: Programmable Search
    // (engine set to "search the entire web") and Places API (New). Places
    // needs a billing account even for its free tier (€5 budget alert).
    'google' => [
        'api_key' => env('GOOGLE_API_KEY'),
        'cse_id'  => env('GOOGLE_CSE_ID'),

        // Fan sign-in, as for Facebook above - an OAuth client, not GOOGLE_API_KEY.
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect'      => rtrim(config('newsletter.frontend_url'), '/') . '/api/fan/auth/google/callback',
        'guzzle'        => ['timeout' => 10, 'connect_timeout' => 10],
    ],

    // Optional: a Reddit "script" app; unauthenticated access is throttled and
    // often blocked from datacenter IPs.
    'reddit' => [
        'client_id'     => env('REDDIT_CLIENT_ID'),
        'client_secret' => env('REDDIT_CLIENT_SECRET'),
        'username'      => env('REDDIT_USERNAME'),
    ],

    'setlistfm' => [
        'api_key' => env('SETLISTFM_API_KEY'),
    ],

    // Admin assistant — machine translation (App\Assistant\Translation). The
    // key alone enables nothing; config/assistant.php picks the driver.
    'deepl' => [
        'api_key' => env('DEEPL_API_KEY'),
    ],

    // Admin assistant — the text model behind Enhance and triage
    // (App\Assistant\Text). Same rule: the key alone enables nothing.
    'anthropic' => [
        'api_key' => env('ANTHROPIC_API_KEY'),
    ],

    'google_wallet' => [
        'enabled'   => env('GOOGLE_WALLET_ENABLED', false),
        'issuer_id' => env('GOOGLE_WALLET_ISSUER_ID', ''),
        'sa_email'  => env('GOOGLE_WALLET_SA_EMAIL', ''),
        'sa_key'    => env('GOOGLE_WALLET_SA_KEY', ''),
    ],

    'stripe' => [
        'secret'       => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'frontend_url' => env('APP_FRONTEND_URL', 'http://localhost:5173'),
    ],

];
