<?php

use App\Assistant\Crawler\Redact;

// A crawl error is logged and stored in assistant_runs.error, which admins
// read. Guzzle's connection errors carry the full request URL, so anything a
// source put in the query string arrives here verbatim.

it('masks a key-like query parameter in a URL', function () {
    $msg = 'cURL error 28: Operation timed out for https://www.googleapis.com/customsearch/v1?key=AIzaSyFAKE123&cx=abc&q=ska';

    expect(Redact::message($msg))
        ->toContain('key=[redacted]')
        ->toContain('cx=abc')
        ->not->toContain('AIzaSyFAKE123');
});

it('masks every credential-shaped parameter name', function (string $param) {
    expect(Redact::message("GET https://x.test/a?{$param}=s3cr3tvalue&b=1"))
        ->not->toContain('s3cr3tvalue')
        ->toContain("{$param}=[redacted]");
})->with(['api_key', 'access_token', 'client_secret', 'token', 'apikey']);

it('masks a configured secret wherever it appears, not only in a URL', function () {
    config(['services.google.api_key' => 'AIzaSyCONFIGURED', 'services.youtube.api_key' => 'YTKEY-9876543']);

    $out = Redact::message('Header X-goog-api-key: AIzaSyCONFIGURED; other YTKEY-9876543.');

    expect($out)->not->toContain('AIzaSyCONFIGURED')->not->toContain('YTKEY-9876543');
});

it('leaves an ordinary message alone', function () {
    expect(Redact::message('provider exploded'))->toBe('provider exploded');
});

it('ignores short or empty configured values, which would mangle normal text', function () {
    config(['services.google.api_key' => '', 'services.google.cse_id' => 'ab']);

    expect(Redact::message('about the band'))->toBe('about the band');
});
