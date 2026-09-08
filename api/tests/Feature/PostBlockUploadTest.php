<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(function () {
    Storage::fake('public');
    Http::fake();
});

it('rejects an anonymous upload', function () {
    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('x.jpg')])
        ->assertUnauthorized();
});

it('stores an uploaded image and returns its path and url', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $res = $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('shot.jpg')])
        ->assertCreated();

    $path = $res->json('path');
    expect($path)->toStartWith('post-blocks/');
    expect($res->json('url'))->toBe('/storage/' . $path);
    Storage::disk('public')->assertExists($path);
});

it('rejects a non-image and an oversized file', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->create('doc.pdf', 10)])
        ->assertStatus(422);

    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('big.jpg')->size(5000)])
        ->assertStatus(422);
});

it('deletes an image file that an update drops from the blocks', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => 'X'],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'no image now']]]],
    ])->assertSuccessful();

    Storage::disk('public')->assertMissing($path);
});

it('keeps an image file that survives an update', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => 'X'],
        'blocks' => [['type' => 'image', 'payload' => ['path' => $path]]],
    ])->assertSuccessful();

    Storage::disk('public')->assertExists($path);
});

it('deletes every block image when the post is deleted', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

    Storage::disk('public')->assertMissing($path);
});
