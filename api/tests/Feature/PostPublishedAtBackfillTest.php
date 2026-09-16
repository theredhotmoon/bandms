<?php

use App\Models\Post;
use App\Support\PostPublishedAtBackfill;
use Illuminate\Support\Carbon;

/**
 * Hiding drafts from the public site would otherwise remove every post that
 * was ever saved without a date — which, on both the dev and production
 * databases, is all of them. The migration that introduces the filter
 * therefore stamps each dateless post with its created_at, so what was
 * visible the day before stays visible, dated the day it was written.
 */

it('sets published_at to created_at on every draft', function () {
    Carbon::setTestNow('2026-09-01 10:00:00');
    $a = Post::factory()->draft()->create();
    Carbon::setTestNow('2026-09-05 12:30:00');
    $b = Post::factory()->draft()->create();
    Carbon::setTestNow();

    $changed = PostPublishedAtBackfill::run();

    expect($changed)->toBe(2);
    expect($a->fresh()->published_at->toDateTimeString())->toBe('2026-09-01 10:00:00');
    expect($b->fresh()->published_at->toDateTimeString())->toBe('2026-09-05 12:30:00');
});

it('leaves an existing published_at untouched', function () {
    $post = Post::factory()->create(['published_at' => '2025-03-03 09:00:00']);

    expect(PostPublishedAtBackfill::run())->toBe(0);
    expect($post->fresh()->published_at->toDateTimeString())->toBe('2025-03-03 09:00:00');
});
