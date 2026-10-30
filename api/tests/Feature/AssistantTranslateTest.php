<?php

use App\Support\Locales;
use Illuminate\Support\Facades\Http;

// POST /api/admin/assistant/translate with the DeepL driver bound. Every HTTP
// call is faked: a test that reaches api-free.deepl.com is a bug.

function otherLocale(): string
{
    return collect(Locales::codes())->first(fn (string $c) => $c !== Locales::default());
}

function item(array $overrides = []): array
{
    return array_merge([
        'key'    => 'k',
        'text'   => 'Hello',
        'format' => 'text',
        'source' => Locales::default(),
        'target' => otherLocale(),
    ], $overrides);
}

function fakeDeepL(array $texts): void
{
    Http::fake(['api-free.deepl.com/*' => Http::response([
        'translations' => array_map(fn (string $t) => ['text' => $t], $texts),
    ])]);
}

dataset('invalid items', [
    'same locale'    => [fn () => ['target' => Locales::default()]],
    'unknown locale' => [['target' => 'xx']],
    'blank text'     => [['text' => '   ']],
    'oversize text'  => [['text' => str_repeat('a', 20001)]],
    'bad format'     => [['format' => 'md']],
]);

it('returns 401 anonymously', function () {
    $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertUnauthorized();
});

describe('with DeepL configured', function () {
    beforeEach(function () {
        config(['assistant.translator' => 'deepl', 'services.deepl.api_key' => 'test-key:fx']);
        $this->actingAsUser();
    });

    it('reports the translate capability on', function () {
        $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.translate', true);
    });

    it('translates items and reports the provider', function () {
        fakeDeepL(['Cześć']);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertOk()
            ->assertJsonPath('data.items.0.key', 'k')
            ->assertJsonPath('data.items.0.text', 'Cześć')
            ->assertJsonPath('data.provider', 'deepl');

        Http::assertSent(fn ($request) => $request['target_lang'] === Locales::translationCode(otherLocale(), 'deepl')
            && $request->hasHeader('Authorization', 'DeepL-Auth-Key test-key:fx'));
    });

    // DeepL takes a regional variant (EN-GB) for target_lang ONLY; source_lang
    // must be the bare language or the call fails with 400 "Value for
    // 'source_lang' not supported" — and a faked HTTP layer cannot see that.
    it('sends the bare language as source_lang, never a regional variant', function () {
        fakeDeepL(['Cześć']);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();

        $registered = Locales::translationCode(Locales::default(), 'deepl');
        expect($registered)->toContain('-'); // the case this test exists for
        Http::assertSent(fn ($request) => $request['source_lang'] === strtok($registered, '-')
            && !str_contains($request['source_lang'], '-'));
    });

    it('sends tag_handling=html for html items and preserves tags', function () {
        $html = '<p>Cześć <a href="/x" target="_blank">tu</a></p>';
        fakeDeepL([$html]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [
            item(['format' => 'html', 'text' => '<p>Hello <a href="/x" target="_blank">here</a></p>']),
        ]])->assertOk()->assertJsonPath('data.items.0.text', $html);

        Http::assertSent(fn ($request) => $request['tag_handling'] === 'html');
    });

    it('does not send tag_handling for plain text', function () {
        fakeDeepL(['Cześć']);
        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
        Http::assertSent(fn ($request) => !isset($request['tag_handling']));
    });

    it('serves a repeat from cache without a second HTTP call', function () {
        fakeDeepL(['Cześć']);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertOk()->assertJsonPath('data.items.0.text', 'Cześć');

        Http::assertSentCount(1);
    });

    it('treats an answer without text as a failure and does not cache it', function () {
        Http::fake(['api-free.deepl.com/*' => Http::sequence()
            ->push(['translations' => [['detected_source_language' => 'XX']]])
            ->push(['translations' => [['text' => 'Cześć']]])]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertStatus(503);
        // Nothing was cached from the malformed answer: the retry reaches DeepL.
        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertOk()->assertJsonPath('data.items.0.text', 'Cześć');
        Http::assertSentCount(2);
    });

    it('retries once on 429 then succeeds', function () {
        Http::fake(['api-free.deepl.com/*' => Http::sequence()
            ->push([], 429)
            ->push(['translations' => [['text' => 'Cześć']]])]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertOk()->assertJsonPath('data.items.0.text', 'Cześć');

        Http::assertSentCount(2);
    });

    it('maps quota exhaustion to 503 with a user message', function () {
        Http::fake(['api-free.deepl.com/*' => Http::response([], 456)]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertStatus(503)
            ->assertJsonPath('message', 'DeepL quota reached for this month.');
    });

    it('maps a rejected key to 503 with a user message', function () {
        Http::fake(['api-free.deepl.com/*' => Http::response([], 403)]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertStatus(503)
            ->assertJsonPath('message', 'DeepL rejected the API key.');
    });

    it('maps any other provider failure to a generic 503', function () {
        Http::fake(['api-free.deepl.com/*' => Http::response([], 500)]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Translation failed — try again.');
    });

    // A registry locale with no `translation.deepl` code passes validation
    // (Rule::in(Locales::codes())) and must come back as the 503-with-message
    // the admin knows how to show, not a 500.
    it('answers 503 for a locale the provider has no code for', function () {
        config(['locales.supported.' . otherLocale() . '.translation' => []]);
        Http::fake();

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Translation into this language is not configured.');
        Http::assertNothingSent();
    });

    it('uses the paid host for a key without the :fx suffix', function () {
        config(['services.deepl.api_key' => 'paid-key']);
        Http::fake(['api.deepl.com/*' => Http::response(['translations' => [['text' => 'x']]])]);

        $this->postJson('/api/admin/assistant/translate', ['items' => [item()]])->assertOk();
        Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api.deepl.com/'));
    });

    it('validates each item', function (array $bad) {
        Http::fake();
        $this->postJson('/api/admin/assistant/translate', ['items' => [item($bad)]])->assertStatus(422);
        Http::assertNothingSent();
    })->with('invalid items');

    it('rejects an empty item list', function () {
        $this->postJson('/api/admin/assistant/translate', ['items' => []])->assertStatus(422);
    });

    it('rejects more than 50 items', function () {
        $this->postJson('/api/admin/assistant/translate', ['items' => array_fill(0, 51, item())])
            ->assertStatus(422);
    });

    it('is rate limited under its own key', function () {
        $route = app('router')->getRoutes()->getByName('api.admin.assistant.translate');
        expect($route->middleware())->toContain('throttle:60,1,assistant-translate');
    });
});
