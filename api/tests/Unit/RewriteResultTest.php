<?php

use App\Assistant\Text\RewriteResult;

it('trims and strips a pair of surrounding quotes', function () {
    expect(RewriteResult::clean("  \"Hello there.\"\n"))->toBe('Hello there.')
        ->and(RewriteResult::clean('„Cześć.”'))->toBe('Cześć.');
});

it('drops a preamble line the model was told not to write', function () {
    expect(RewriteResult::clean("Here is a punchier version:\nCome early.\nDoors 19:00."))->toBe("Come early.\nDoors 19:00.")
        ->and(RewriteResult::clean("Oto poprawiona wersja:\n\nWpadnij wcześniej."))->toBe('Wpadnij wcześniej.');
});

it('keeps a heading line the band wrote themselves', function () {
    $original = "Support acts:\nThe Toasters\nDoors 19:00";
    expect(RewriteResult::clean("Support acts:\nThe Toasters\nDoors 19:00.", $original))->toBe("Support acts:\nThe Toasters\nDoors 19:00.");
});

it('keeps quotes the band wrapped their own text in', function () {
    expect(RewriteResult::clean('"A quoted review line."', '"A quoted review line"'))->toBe('"A quoted review line."');
});

it('does not strip a quote pair that merely opens and closes inside', function () {
    expect(RewriteResult::clean('"Hello" said X "bye"'))->toBe('"Hello" said X "bye"');
});

it('leaves an ordinary text alone', function () {
    expect(RewriteResult::clean('Doors 19:00. "Quoted" words inside stay.'))->toBe('Doors 19:00. "Quoted" words inside stay.');
});

it('keeps html tags and attributes', function () {
    $html = '<p>Hi <a href="/x" target="_blank">there</a></p>';
    expect(RewriteResult::clean($html))->toBe($html);
});

it('flags scripts and handlers as unsafe html', function (string $html) {
    expect(RewriteResult::isUnsafeHtml($html))->toBeTrue();
})->with([
    '<p>x</p><script>alert(1)</script>',
    '<a href="javascript:alert(1)">x</a>',
    '<p onclick="x()">x</p>',
    '<img src=x onerror=alert(1)>',
    '<p>x</p><iframe src="https://evil.example"></iframe>',
    '<object data="x.swf"></object>',
    '<embed src="x">',
    '<style>p{display:none}</style>',
    '<svg onload=alert(1)>',
    '<a href="data:text/html;base64,AAAA">x</a>',
    '<a href="vbscript:x">x</a>',
    '<iframe srcdoc="<script>x</script>"></iframe>',
    '<form action="/x"><input></form>',
]);

it('accepts the editor\'s own markup', function () {
    expect(RewriteResult::isUnsafeHtml('<p>Hi <strong>there</strong> <a href="https://x.y" target="_blank" rel="noopener">link</a></p><ul><li>a</li></ul><h2>T</h2><blockquote>q</blockquote>'))->toBeFalse();
});

it('does not mistake prose for an event handler', function () {
    expect(RewriteResult::isUnsafeHtml('<p>Tickets online = cheaper at the door</p>'))->toBeFalse();
});
