<?php

use App\Support\Geo\MaxMindLocator;
use Tests\TestCase;

uses(TestCase::class);

it('is unavailable and locates nothing without a database file', function () {
    config(['geoip.path' => sys_get_temp_dir().'/no-such-'.uniqid().'.mmdb']);
    $locator = new MaxMindLocator;

    expect($locator->available())->toBeFalse()
        ->and($locator->locate('8.8.8.8'))->toBeNull();
});

it('does not locate a private address', function () {
    $file = tempnam(sys_get_temp_dir(), 'mmdb');
    config(['geoip.path' => $file]);
    $locator = new MaxMindLocator;

    expect($locator->available())->toBeTrue()
        ->and($locator->locate('10.0.0.1'))->toBeNull();
    unlink($file);
});
