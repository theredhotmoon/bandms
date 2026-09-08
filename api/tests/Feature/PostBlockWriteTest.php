<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

beforeEach(function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    Http::fake();
});

it('creates a post with blocks in the submitted order', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Blocked post'],
        'blocks' => [
            ['type' => 'text',  'payload' => ['body' => ['en' => 'First']]],
            ['type' => 'embed', 'payload' => ['url' => 'https://youtu.be/dQw4w9WgXcQ']],
            ['type' => 'text',  'payload' => ['body' => ['en' => 'Third']]],
        ],
    ])->assertCreated()
      ->assertJsonPath('data.blocks.0.body', 'First')
      ->assertJsonPath('data.blocks.1.provider', 'youtube')
      ->assertJsonPath('data.blocks.2.body', 'Third');
});

// Position comes from the array index, never from insertion order. This is the
// trap post_links fell into: it ordered correctly only because delete-and-
// recreate happened to make auto-increment id match.
it('sets position from the array index', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Positions'],
        'blocks' => [
            ['type' => 'text', 'payload' => ['body' => ['en' => 'A']]],
            ['type' => 'text', 'payload' => ['body' => ['en' => 'B']]],
        ],
    ])->assertCreated();

    expect(PostBlock::orderBy('position')->pluck('position')->all())->toBe([0, 1]);
});

it('replaces blocks wholesale on update', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Old')->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => $post->title],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'New']]]],
    ])->assertSuccessful();

    expect($post->blocks()->count())->toBe(1);
    expect($post->blocks()->first()->payload['body']['en'])->toBe('New');
});

it('leaves blocks alone when the key is absent from an update', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Kept')->create();

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])->assertSuccessful();

    expect($post->blocks()->count())->toBe(1);
});

it('clears blocks when an empty array is sent', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Gone')->create();

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'X'], 'blocks' => []])->assertSuccessful();

    expect($post->blocks()->count())->toBe(0);
});

it('detects and stores the embed provider server-side', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Embeds'],
        'blocks' => [['type' => 'embed', 'payload' => ['url' => 'https://vimeo.com/76979871']]],
    ])->assertCreated();

    expect(PostBlock::first()->payload['provider'])->toBe('vimeo');
});

describe('validation', function () {
    it('rejects an unknown block type', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'carousel', 'payload' => []]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.type');
    });

    it('rejects an embed block with no url', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'embed', 'payload' => ['label' => 'nope']]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.url');
    });

    it('rejects a ref block naming an entity that is not a ref target', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'ref', 'payload' => ['entity' => 'tour', 'id' => 1]]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.entity');
    });

    it('rejects an image block with no path', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'image', 'payload' => ['alt' => ['en' => 'x']]]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.path');
    });
});

// A failure in the block loop must not leave a half-saved post behind.
it('rolls the post back when a block write fails', function () {
    $before = Post::count();

    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Doomed'],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => str_repeat('x', 70000)]]]],
    ]);

    expect(Post::count())->toBe($before);
})->skip(fn () => DB::connection()->getDriverName() === 'sqlite', 'SQLite does not enforce the length that trips this');

describe('SiteRebuild', function () {
    beforeEach(fn () => \App\Models\SiteSetting::set('auto_rebuild', 'true'));

    it('requests a rebuild on create, update and delete', function () {
        $this->postJson('/api/posts', ['title' => ['en' => 'A']])->assertCreated();
        $post = Post::first();
        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'B']])->assertSuccessful();
        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

        Http::assertSentCount(3);
    });
});
