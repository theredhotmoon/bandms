<?php

return [
    // MaxMind GeoLite2-City. The download needs the account id and licence key
    // (HTTP basic auth); without them the welcome screen's geo targeting is
    // simply unavailable and fails open.
    'account_id'  => env('MAXMIND_ACCOUNT_ID', ''),
    'license_key' => env('MAXMIND_LICENSE_KEY', ''),
    'path'        => storage_path('app/geoip/GeoLite2-City.mmdb'),
];
