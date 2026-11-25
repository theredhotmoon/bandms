<?php

return [
    // A fan session lasts this long after its last use (sliding).
    'session_days' => 180,

    // A link session this young may change the password without the current
    // one: opening the emailed link just proved the fan owns the mailbox.
    'fresh_link_minutes' => 15,

    // Social sign-in. A provider is on only when services.<name> has both a
    // client id and a secret (App\Support\FanProviders). trust_email: the
    // provider vouches for the address, so it may link to an existing account —
    // Google only where it runs the mailbox (FanSocialAuthController::googleVouches).
    'providers' => [
        'google'   => ['trust_email' => true,  'scopes' => ['openid', 'email']],
        'facebook' => ['trust_email' => false, 'scopes' => ['email']],
    ],
];
