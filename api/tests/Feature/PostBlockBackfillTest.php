<?php

use App\Support\PostBlockBackfill;

/** The old-shape row a post looked like before this feature. */
function oldPost(array $overrides = []): array
{
    return array_merge([
        'content'           => null,
        'press_release_ids' => [],
        'release_ids'       => [],
        'music_video_ids'   => [],
        'concert_ids'       => [],
        'album_ids'         => [],
        'links'             => [],
    ], $overrides);
}

it('emits content as a text block at position 0, preserving translations', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'content' => '{"en":"<p>Hello</p>","pl":"<p>Cześć</p>"}',
    ]));

    expect($blocks)->toHaveCount(1);
    expect($blocks[0]['position'])->toBe(0);
    expect($blocks[0]['type'])->toBe('text');
    expect($blocks[0]['payload']['body']['en'])->toBe('<p>Hello</p>');
    expect($blocks[0]['payload']['body']['pl'])->toBe('<p>Cześć</p>');
});

// Rows predating 2026_06_14_000001_make_posts_fields_translatable hold a bare
// string, not JSON. Wrapping it as English loses nothing; dropping it loses the
// whole article body.
it('treats a non-JSON legacy content value as English', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost(['content' => 'Plain old body']));

    expect($blocks[0]['payload']['body'])->toBe(['en' => 'Plain old body', 'pl' => null]);
});

it('emits no text block when content is null or empty', function () {
    expect(PostBlockBackfill::blocksFor(oldPost(['content' => null])))->toBe([]);
    expect(PostBlockBackfill::blocksFor(oldPost(['content' => '{"en":"","pl":""}'])))->toBe([]);
});

// The order reproduces what PostDetail.astro renders today:
// content -> press pull-quote -> Related -> In the press -> links.
it('orders content, then press, then related, then links', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'content'           => '{"en":"Body"}',
        'press_release_ids' => [90],
        'release_ids'       => [10],
        'music_video_ids'   => [20],
        'concert_ids'       => [30],
        'album_ids'         => [40],
        'links'             => [['type' => 'normal', 'url' => 'https://example.com', 'label' => 'Read']],
    ]));

    expect(array_column($blocks, 'position'))->toBe([0, 1, 2, 3, 4, 5, 6]);
    expect(array_column($blocks, 'type'))->toBe(['text', 'ref', 'ref', 'ref', 'ref', 'ref', 'embed']);
    expect(array_column(array_column($blocks, 'payload'), 'entity'))
        ->toBe(['press_release', 'release', 'music_video', 'concert', 'album']);
});

it('keeps link labels rather than discarding them', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [['type' => 'normal', 'url' => 'https://example.com', 'label' => 'Read more']],
    ]));

    expect($blocks[0]['payload']['label'])->toBe('Read more');
});

// The old type column carries `facebook`, which is not a provider in the new
// taxonomy. Mapping it straight across would store a value nothing renders.
it('re-detects the provider from the url instead of mapping the old type column', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [
            ['type' => 'facebook', 'url' => 'https://facebook.com/band/posts/1', 'label' => null],
            ['type' => 'normal',   'url' => 'https://youtu.be/dQw4w9WgXcQ',      'label' => null],
        ],
    ]));

    expect($blocks[0]['payload']['provider'])->toBe('link');
    expect($blocks[1]['payload']['provider'])->toBe('youtube');
});

it('preserves the incoming link order', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [
            ['type' => 'normal', 'url' => 'https://one.example', 'label' => null],
            ['type' => 'normal', 'url' => 'https://two.example', 'label' => null],
        ],
    ]));

    expect(array_column(array_column($blocks, 'payload'), 'url'))
        ->toBe(['https://one.example', 'https://two.example']);
});

it('emits nothing at all for an empty post', function () {
    expect(PostBlockBackfill::blocksFor(oldPost()))->toBe([]);
});
