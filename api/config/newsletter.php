<?php

return [
    /*
     * When true, the subscribe endpoint checks that the email domain
     * has valid MX (or A) DNS records before storing the address.
     * Set to false in tests via phpunit.xml or .env.
     */
    'verify_mx' => (bool) env('NEWSLETTER_VERIFY_MX', true),

    /*
     * Public frontend URL used to build confirmation / unsubscribe links
     * in outgoing emails. Defaults to APP_URL.
     */
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost')),
];
