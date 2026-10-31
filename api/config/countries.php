<?php

/*
|--------------------------------------------------------------------------
| Countries the crawler can search
|--------------------------------------------------------------------------
|
| ISO 3166-1 alpha-2 → English name, native name, and Google's `gl` (country)
| and `hl` (interface language) for that market. A curated list of the ska
| scene, not the whole world — every code must also be in
| App\Support\ContactCodes::COUNTRIES, the list venues and bands validate
| against, so a lead saved from any of these keeps its country.
|
| Google calls the UK `uk`, not `gb` — that row is the reason `gl` is stored
| rather than derived. Add a country with one row; nothing else changes.
|
*/
return [
    'AR' => ['name' => 'Argentina',      'native' => 'Argentina',      'gl' => 'ar', 'hl' => 'es'],
    'AT' => ['name' => 'Austria',        'native' => 'Österreich',     'gl' => 'at', 'hl' => 'de'],
    'AU' => ['name' => 'Australia',      'native' => 'Australia',      'gl' => 'au', 'hl' => 'en'],
    'BE' => ['name' => 'Belgium',        'native' => 'België',         'gl' => 'be', 'hl' => 'nl'],
    'BR' => ['name' => 'Brazil',         'native' => 'Brasil',         'gl' => 'br', 'hl' => 'pt'],
    'CA' => ['name' => 'Canada',         'native' => 'Canada',         'gl' => 'ca', 'hl' => 'en'],
    'CH' => ['name' => 'Switzerland',    'native' => 'Schweiz',        'gl' => 'ch', 'hl' => 'de'],
    'CL' => ['name' => 'Chile',          'native' => 'Chile',          'gl' => 'cl', 'hl' => 'es'],
    'CO' => ['name' => 'Colombia',       'native' => 'Colombia',       'gl' => 'co', 'hl' => 'es'],
    'CZ' => ['name' => 'Czechia',        'native' => 'Česko',          'gl' => 'cz', 'hl' => 'cs'],
    'DE' => ['name' => 'Germany',        'native' => 'Deutschland',    'gl' => 'de', 'hl' => 'de'],
    'DK' => ['name' => 'Denmark',        'native' => 'Danmark',        'gl' => 'dk', 'hl' => 'da'],
    'ES' => ['name' => 'Spain',          'native' => 'España',         'gl' => 'es', 'hl' => 'es'],
    'FI' => ['name' => 'Finland',        'native' => 'Suomi',          'gl' => 'fi', 'hl' => 'fi'],
    'FR' => ['name' => 'France',         'native' => 'France',         'gl' => 'fr', 'hl' => 'fr'],
    'GB' => ['name' => 'United Kingdom', 'native' => 'United Kingdom', 'gl' => 'uk', 'hl' => 'en'],
    'HR' => ['name' => 'Croatia',        'native' => 'Hrvatska',       'gl' => 'hr', 'hl' => 'hr'],
    'HU' => ['name' => 'Hungary',        'native' => 'Magyarország',   'gl' => 'hu', 'hl' => 'hu'],
    'IE' => ['name' => 'Ireland',        'native' => 'Ireland',        'gl' => 'ie', 'hl' => 'en'],
    'IT' => ['name' => 'Italy',          'native' => 'Italia',         'gl' => 'it', 'hl' => 'it'],
    'JM' => ['name' => 'Jamaica',        'native' => 'Jamaica',        'gl' => 'jm', 'hl' => 'en'],
    'JP' => ['name' => 'Japan',          'native' => '日本',            'gl' => 'jp', 'hl' => 'ja'],
    'LT' => ['name' => 'Lithuania',      'native' => 'Lietuva',        'gl' => 'lt', 'hl' => 'lt'],
    'LV' => ['name' => 'Latvia',         'native' => 'Latvija',        'gl' => 'lv', 'hl' => 'lv'],
    'MX' => ['name' => 'Mexico',         'native' => 'México',         'gl' => 'mx', 'hl' => 'es'],
    'NL' => ['name' => 'Netherlands',    'native' => 'Nederland',      'gl' => 'nl', 'hl' => 'nl'],
    'NO' => ['name' => 'Norway',         'native' => 'Norge',          'gl' => 'no', 'hl' => 'no'],
    'PE' => ['name' => 'Peru',           'native' => 'Perú',           'gl' => 'pe', 'hl' => 'es'],
    'PL' => ['name' => 'Poland',         'native' => 'Polska',         'gl' => 'pl', 'hl' => 'pl'],
    'PT' => ['name' => 'Portugal',       'native' => 'Portugal',       'gl' => 'pt', 'hl' => 'pt'],
    'RS' => ['name' => 'Serbia',         'native' => 'Srbija',         'gl' => 'rs', 'hl' => 'sr'],
    'SE' => ['name' => 'Sweden',         'native' => 'Sverige',        'gl' => 'se', 'hl' => 'sv'],
    'SI' => ['name' => 'Slovenia',       'native' => 'Slovenija',      'gl' => 'si', 'hl' => 'sl'],
    'SK' => ['name' => 'Slovakia',       'native' => 'Slovensko',      'gl' => 'sk', 'hl' => 'sk'],
    'UA' => ['name' => 'Ukraine',        'native' => 'Україна',        'gl' => 'ua', 'hl' => 'uk'],
    'US' => ['name' => 'United States',  'native' => 'United States',  'gl' => 'us', 'hl' => 'en'],
];
