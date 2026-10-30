<?php

use App\Assistant\Text\RewriteMode;
use App\Assistant\Text\RewritePrompt;
use App\Assistant\Text\RewriteRequest;
use App\Support\Locales;

uses(Tests\TestCase::class);

function rewriteRequest(array $o = []): RewriteRequest
{
    return new RewriteRequest(
        text: $o['text'] ?? 'Doors 19:00, Klub Hydrozagadka, 40 zł.',
        format: $o['format'] ?? 'text',
        locale: $o['locale'] ?? Locales::default(),
        mode: $o['mode'] ?? RewriteMode::Flow,
        fieldKey: 'concert.description',
        maxLength: $o['maxLength'] ?? 2000,
        examples: $o['examples'] ?? [],
    );
}

it('names the language of the text from the registry, not a literal', function () {
    $prompt   = RewritePrompt::build(rewriteRequest());
    $language = collect(Locales::all())->firstWhere('code', Locales::default())['name'];

    expect($prompt['system'])->toContain($language);
});

it('tells the model to keep every fact verbatim and to return only the text', function () {
    $system = RewritePrompt::build(rewriteRequest())['system'];

    expect($system)->toContain('verbatim')
        ->and(strtolower($system))->toContain('names, dates, times, places, prices, urls')
        ->and(strtolower($system))->toContain('only the rewritten text');
});

it('states the length the field can hold', function () {
    expect(RewritePrompt::build(rewriteRequest(['maxLength' => 1234]))['system'])->toContain('1234');
});

it('carries the mode instruction and every mode has one', function () {
    foreach (RewriteMode::cases() as $mode) {
        expect($mode->instruction())->not->toBe('');
        expect(RewritePrompt::build(rewriteRequest(['mode' => $mode]))['user'])->toContain($mode->instruction());
    }
});

it('says the examples show the voice only — no fact may be copied from them', function () {
    $system = strtolower(RewritePrompt::build(rewriteRequest(['examples' => ['Tickets 40 zł.']]))['system']);

    expect($system)->toContain('examples')
        ->and($system)->toContain('voice')
        ->and($system)->toContain('never copy');
});

it('fences each example and the text', function () {
    $user = RewritePrompt::build(rewriteRequest(['examples' => ['First one.', 'Second one.']]))['user'];

    expect($user)->toContain('<example>First one.</example>')
        ->and($user)->toContain('<example>Second one.</example>')
        ->and($user)->toContain('<text>Doors 19:00, Klub Hydrozagadka, 40 zł.</text>');
});

it('mentions html handling only for html input', function () {
    expect(strtolower(RewritePrompt::build(rewriteRequest(['format' => 'html']))['system']))->toContain('html')
        ->and(strtolower(RewritePrompt::build(rewriteRequest())['system']))->not->toContain('html');
});
