<?php

use App\Support\Locales;

uses(Tests\TestCase::class);

it('lists the supported locale codes', function () {
    expect(Locales::codes())->toBe(['en', 'pl']);
});

it('names a default locale that is itself supported', function () {
    expect(Locales::default())->toBe('en')
        ->and(Locales::isSupported('en'))->toBeTrue();
});

it('rejects a locale that is not registered', function () {
    expect(Locales::isSupported('de'))->toBeFalse()
        ->and(Locales::isSupported('EN'))->toBeFalse()
        ->and(Locales::isSupported(''))->toBeFalse();
});

// The chain is the whole policy: a locale resolves through its own declared
// fallbacks and nothing else. No "scan every other locale" tail — that is the
// part that shows a German visitor Polish text once a third locale exists.
it('walks a locale through its own declared fallbacks', function () {
    expect(Locales::chain('pl'))->toBe(['pl', 'en'])
        ->and(Locales::chain('en'))->toBe(['en', 'pl']);
});

it('starts the chain from the default for an unsupported locale', function () {
    expect(Locales::chain('de'))->toBe(['en', 'pl']);
});

it('never repeats a locale in a chain', function () {
    expect(Locales::chain('en'))->toBe(array_unique(Locales::chain('en')));
});

it('resolves to the requested locale when it has a value', function () {
    $t = ['en' => 'Where is the bio?', 'pl' => 'Gdzie jest bio?'];

    expect(Locales::resolve($t, 'pl'))->toBe('Gdzie jest bio?');
});

it('resolves down the chain when the requested locale is empty', function () {
    expect(Locales::resolve(['en' => 'English only'], 'pl'))->toBe('English only')
        ->and(Locales::resolve(['en' => '', 'pl' => 'Polski'], 'en'))->toBe('Polski');
});

it('treats an empty string as absent, not as a translation', function () {
    expect(Locales::resolve(['pl' => '   ', 'en' => 'Real'], 'pl'))->toBe('Real');
});

it('returns null when no locale in the chain has a value', function () {
    expect(Locales::resolve([], 'pl'))->toBeNull()
        ->and(Locales::resolve(['de' => 'Deutsch'], 'pl'))->toBeNull();
});

// The admin API validates incoming {field: {en: ..., pl: ...}} bags against
// this list, so an unregistered key must be reportable rather than silently
// stored where nothing will ever read it.
it('reports which keys of a translation bag are not registered locales', function () {
    expect(Locales::unsupportedKeys(['en' => 'a', 'de' => 'b', 'xx' => 'c']))->toBe(['de', 'xx'])
        ->and(Locales::unsupportedKeys(['en' => 'a', 'pl' => 'b']))->toBe([]);
});

// Shape the public site and the admin both consume to build language switchers
// and hreflang alternates without hardcoding a pair.
it('exposes display metadata for every locale', function () {
    $all = Locales::all();

    expect($all)->toHaveCount(2)
        ->and($all[0])->toMatchArray([
            'code'        => 'en',
            'native_name' => 'English',
            'date_locale' => 'en-GB',
            'is_default'  => true,
        ])
        ->and($all[1])->toMatchArray([
            'code'        => 'pl',
            'native_name' => 'Polski',
            'date_locale' => 'pl-PL',
            'is_default'  => false,
        ]);
});
