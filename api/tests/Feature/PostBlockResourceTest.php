<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Release;

it('serialises a text block with the resolved locale and all translations', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('English body', 'Polski tekst')->create();

    $this->getJson("/api/posts/{$post->id}?lang=pl")
        ->assertSuccessful()
        ->assertJsonPath('data.blocks.0.type', 'text')
        ->assertJsonPath('data.blocks.0.body', 'Polski tekst')
        ->assertJsonPath('data.blocks.0.translations.body.en', 'English body');
});

it('serialises an embed block with its provider and extracted id', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->embed('https://vimeo.com/76979871', 'vimeo')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.provider', 'vimeo')
        ->assertJsonPath('data.blocks.0.embed_id', '76979871');
});

it('serialises an image block as an absolute storage url', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image('post-blocks/ab12cd.webp')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.type', 'image')
        ->assertJsonPath('data.blocks.0.url', '/storage/post-blocks/ab12cd.webp');
});

it('serialises a resolved ref block', function () {
    $release = Release::factory()->create(['title' => 'Second Album']);
    $post    = Post::factory()->create();
    PostBlock::factory()->for($post)->ref('release', $release->id)->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.entity', 'release')
        ->assertJsonPath('data.blocks.0.data.title', 'Second Album');
});

// Emitted, not omitted: the public renderer skips it, but the admin needs to
// see it to offer "missing item — remove?".
it('emits a dangling ref with null data rather than omitting the block', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->ref('release', 999999)->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonCount(1, 'data.blocks')
        ->assertJsonPath('data.blocks.0.data', null);
});

it('returns blocks in position order', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->at(1)->text('Second')->create();
    PostBlock::factory()->for($post)->at(0)->text('First')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.body', 'First')
        ->assertJsonPath('data.blocks.1.body', 'Second');
});

describe('PostSummaryResource excerpt', function () {
    it('derives the excerpt from the first text block', function () {
        $post = Post::factory()->create(['intro' => null]);
        PostBlock::factory()->for($post)->at(0)->ref('release', 1)->create();
        PostBlock::factory()->for($post)->at(1)->text('The body of the article')->create();

        $this->getJson('/api/posts')->assertJsonPath('data.0.excerpt', 'The body of the article');
    });

    it('falls back to intro when there is no text block', function () {
        $post = Post::factory()->create(['intro' => 'Just an intro']);
        PostBlock::factory()->for($post)->image('post-blocks/x.webp')->create();

        $this->getJson('/api/posts')->assertJsonPath('data.0.excerpt', 'Just an intro');
    });

    // The listing has no use for block payloads, and web/ fetches it page by
    // page on every article page to build prev/next.
    it('does not serialise blocks in the listing', function () {
        $post = Post::factory()->create();
        PostBlock::factory()->for($post)->text('Body')->create();

        $this->getJson('/api/posts')->assertJsonMissingPath('data.0.blocks');
    });

    it('issues a constant number of queries regardless of post count', function () {
        Post::factory()->count(3)->create()->each(
            fn ($p) => PostBlock::factory()->for($p)->text('Body')->create()
        );

        DB::enableQueryLog();
        $this->getJson('/api/posts')->assertSuccessful();
        $few = count(DB::getQueryLog());
        DB::flushQueryLog();
        DB::disableQueryLog();

        // The log must stay off while this setup batch inserts — otherwise its
        // 18 insert queries get counted as part of the *next* request's total.
        Post::factory()->count(9)->create()->each(
            fn ($p) => PostBlock::factory()->for($p)->text('Body')->create()
        );

        DB::enableQueryLog();
        $this->getJson('/api/posts')->assertSuccessful();
        $many = count(DB::getQueryLog());
        DB::disableQueryLog();

        expect($many)->toBe($few);
    });
});
