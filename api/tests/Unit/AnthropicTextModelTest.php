<?php

use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use App\Assistant\Text\AnthropicTextModel;
use App\Assistant\Text\RewriteMode;
use GuzzleHttp\Psr7\Request as PsrRequest;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Tests\Support\StubMessagesGateway as StubGateway;
use App\Assistant\Text\RewriteRequest;
use App\Assistant\Text\TextModelUnavailable;
use App\Support\Locales;

uses(Tests\TestCase::class);

// The driver is tested through a stub gateway (tests/Support) — the one seam
// between our code and the SDK — so nothing here touches the network.

function message(string $text, string $stopReason = 'end_turn', bool $thinkingFirst = false): object
{
    $blocks = $thinkingFirst ? [(object) ['type' => 'thinking', 'thinking' => '…']] : [];
    $blocks[] = (object) ['type' => 'text', 'text' => $text];

    return (object) ['content' => $blocks, 'stopReason' => $stopReason, 'model' => 'claude-x'];
}

function rewriteReq(): RewriteRequest
{
    return new RewriteRequest('Doors 19:00.', 'text', Locales::default(), RewriteMode::Flow, 'concert.description', 2000, ['An example.']);
}

it('sends the configured model, effort, token budget and fallback, and returns the text block', function () {
    $gateway = new StubGateway(fn () => message('Doors at seven.', thinkingFirst: true));
    $driver  = new AnthropicTextModel($gateway, 'claude-test-model');

    expect($driver->rewrite(rewriteReq()))->toBe('Doors at seven.');

    $p = $gateway->lastParams;
    expect($p['model'])->toBe('claude-test-model')
        ->and($p['maxTokens'])->toBe(16000)
        ->and($p['outputConfig']['effort'])->toBe('medium')
        ->and($p['betas'])->toContain('server-side-fallback-2026-07-01')
        ->and($p['fallbacks'])->toBe('default')
        ->and($p)->not->toHaveKey('thinking')
        ->and($p['system'])->toContain('verbatim')
        ->and($p['messages'][0]['content'])->toContain('<example>An example.</example>');
});

it('bounds the request time below the web server\'s and retries at most once', function () {
    $gateway = new StubGateway(fn () => message('x'));
    (new AnthropicTextModel($gateway, 'm'))->rewrite(rewriteReq());

    expect($gateway->lastParams['requestOptions']['timeout'])->toBeLessThanOrEqual(110)
        ->and($gateway->lastParams['requestOptions']['maxRetries'])->toBeLessThanOrEqual(1);
});

it('turns a timeout into "took too long" and a broken SDK into a plain failure', function () {
    $timeout = new AnthropicTextModel(new StubGateway(fn () => throw new \Anthropic\Core\Exceptions\APITimeoutException(new PsrRequest('POST', '/v1/messages'), null, 'timed out')), 'm');
    expect(fn () => $timeout->rewrite(rewriteReq()))->toThrow(TextModelUnavailable::class, 'took too long');

    $broken = new AnthropicTextModel(new StubGateway(fn () => throw new \Error('Unknown named parameter $fallbacks')), 'm');
    expect(fn () => $broken->rewrite(rewriteReq()))->toThrow(TextModelUnavailable::class, 'try again');
});

it('sends no refusal fallback on a structured call — the triage model has none', function () {
    $gateway = new StubGateway(fn () => message('{"a":1}'));
    (new AnthropicTextModel($gateway, 'm'))->structured('s', 'u', ['type' => 'object'], 'claude-cheap');

    expect($gateway->lastParams)->not->toHaveKey('fallbacks')
        ->and($gateway->lastParams)->not->toHaveKey('betas');
});

it('turns a refusal into an unavailable error', function () {
    $driver = new AnthropicTextModel(new StubGateway(fn () => message('', 'refusal')), 'm');
    expect(fn () => $driver->rewrite(rewriteReq()))->toThrow(TextModelUnavailable::class, 'declined');
});

it('turns a max_tokens stop into "too long", never a cut-off text', function () {
    $driver = new AnthropicTextModel(new StubGateway(fn () => message('Doors at sev', 'max_tokens')), 'm');
    expect(fn () => $driver->rewrite(rewriteReq()))->toThrow(TextModelUnavailable::class, 'too long');
});

it('maps SDK failures to distinct user messages', function (\Throwable $e, string $expected) {
    $driver = new AnthropicTextModel(new StubGateway(fn () => throw $e), 'm');
    expect(fn () => $driver->rewrite(rewriteReq()))->toThrow(TextModelUnavailable::class, $expected);
})->with([
    'rate limit' => [fn () => new RateLimitException(new PsrRequest('POST', '/v1/messages'), new PsrResponse(429), null, 'slow down'), 'busy'],
    'auth'       => [fn () => new AuthenticationException(new PsrRequest('POST', '/v1/messages'), new PsrResponse(401), null, 'bad key'), 'rejected the API key'],
    'connection' => [fn () => new APIConnectionException(new PsrRequest('POST', '/v1/messages'), null, 'down'), 'try again'],
]);

it('answers structured requests as decoded JSON with the json_schema format and the given model', function () {
    $gateway = new StubGateway(fn () => message('{"relevant": true, "score": 80}'));
    $driver  = new AnthropicTextModel($gateway, 'claude-default');

    $out = $driver->structured('sys', 'user', ['type' => 'object'], 'claude-cheap');

    expect($out)->toBe(['relevant' => true, 'score' => 80])
        ->and($gateway->lastParams['model'])->toBe('claude-cheap')
        ->and($gateway->lastParams['outputConfig']['format']['type'])->toBe('json_schema')
        ->and($gateway->lastParams['outputConfig']['format']['schema'])->toBe(['type' => 'object']);
});

it('treats non-JSON from a structured request as unavailable', function () {
    $driver = new AnthropicTextModel(new StubGateway(fn () => message('not json')), 'm');
    expect(fn () => $driver->structured('s', 'u', ['type' => 'object']))->toThrow(TextModelUnavailable::class);
});
