<?php

use App\Support\SafeUrl;
use GuzzleHttp\Psr7\Response;

// A feed address is typed by a person: a response far larger than any feed
// must be stopped while it downloads, not after the worker has buffered it.
// The abort itself is curl's (a non-zero XFERINFOFUNCTION return) — a
// thrown exception inside Guzzle's `progress` callback does NOT stop the
// transfer, which a timed probe against a slow 5 MB stream showed (10.6 s,
// the whole body). These pin the callbacks; SafeUrl::get() turns a trip into
// one readable error.

it('refuses a declared Content-Length over the limit, before reading the body', function () {
    $tripped = new ArrayObject();
    $guard = SafeUrl::sizeGuard(1000, $tripped)['on_headers'];

    $guard(new Response(200, ['Content-Length' => '900'])); // fine
    expect($tripped->count())->toBe(0);

    expect(fn () => $guard(new Response(200, ['Content-Length' => '5000'])))->toThrow(\RuntimeException::class);
    expect($tripped->count())->toBe(1);
});

it('asks curl to abort once an undeclared download passes the limit', function () {
    $tripped = new ArrayObject();
    $abort = SafeUrl::sizeGuard(1000, $tripped)['curl'][CURLOPT_XFERINFOFUNCTION];

    expect($abort(null, 0, 800, 0, 0))->toBe(0)
        ->and($tripped->count())->toBe(0)
        ->and($abort(null, 0, 1500, 0, 0))->toBe(1) // non-zero: curl stops the transfer
        ->and($tripped->count())->toBe(1);
    expect(SafeUrl::sizeGuard(1000, $tripped)['curl'][CURLOPT_NOPROGRESS])->toBeFalse();
});
