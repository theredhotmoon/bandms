<?php

use App\Models\Post;
use App\Models\PostBlock;

// The admin news list flags a post with no cover image and the languages a
// post is missing; the public list carries neither flag's data it does not use.

describe('GET /api/admin/posts — list flags', function () {
    beforeEach(fn () => $this->actingAsAdmin());

    it('reports, per language, what has no text', function () {
        $post = Post::factory()->create([
            'title' => ['en' => 'Tour', 'pl' => 'Trasa'],
            'intro' => ['en' => 'Intro', 'pl' => null],
            'slug'  => ['en' => 'tour', 'pl' => 'trasa'],
        ]);
        PostBlock::factory()->for($post)->text('<p>Body</p>', '<p></p>')->create();

        $this->getJson('/api/admin/posts')
            ->assertOk()
            ->assertJsonPath('data.0.translation_gaps.en', [])
            ->assertJsonPath('data.0.translation_gaps.pl', ['intro', 'blocks']);
    });

    it('returns the cover image so the list can flag a post without one', function () {
        Post::factory()->create(['image' => 'post-images/a.webp']);

        $this->getJson('/api/admin/posts')
            ->assertJsonPath('data.0.image', '/storage/post-images/a.webp');
    });

    it('keeps the gaps off the public list', function () {
        Post::factory()->create();

        expect($this->getJson('/api/posts')->json('data.0'))->not->toHaveKey('translation_gaps');
    });
});
