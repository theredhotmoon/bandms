<?php

use App\Models\Post;
use App\Models\PostBlock;

it('casts payload to an array', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::create([
        'post_id'  => $post->id,
        'position' => 0,
        'type'     => 'text',
        'payload'  => ['body' => ['en' => 'Hello', 'pl' => 'Cześć']],
    ]);

    expect($block->fresh()->payload)->toBe(['body' => ['en' => 'Hello', 'pl' => 'Cześć']]);
});

// Ordering is explicit, not incidental. post_links used to work by accident
// because delete-and-recreate made auto-increment id match array order; the
// moment anything stops recreating from scratch that breaks silently.
it('orders blocks by position, not by id', function () {
    $post = Post::factory()->create();

    $second = PostBlock::create(['post_id' => $post->id, 'position' => 1, 'type' => 'text', 'payload' => ['body' => ['en' => 'B']]]);
    $first  = PostBlock::create(['post_id' => $post->id, 'position' => 0, 'type' => 'text', 'payload' => ['body' => ['en' => 'A']]]);

    expect($second->id)->toBeLessThan($first->id);
    expect($post->blocks()->pluck('id')->all())->toBe([$first->id, $second->id]);
});

it('cascades on post delete', function () {
    $post = Post::factory()->create();
    PostBlock::create(['post_id' => $post->id, 'position' => 0, 'type' => 'text', 'payload' => ['body' => ['en' => 'A']]]);

    $post->delete();

    expect(PostBlock::count())->toBe(0);
});
