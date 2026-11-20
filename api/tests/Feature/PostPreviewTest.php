<?php

use App\Models\Post;
use App\Models\User;
use Laravel\Passport\Passport;

// Draft previews: every post carries a secret `preview_token`; the public
// build lists drafts from /api/internal/post-previews (Docker network only)
// and bakes each at /{lang}/post-preview/{token}/.

beforeEach(fn () => $this->createProfile());

it('gives every new post a long random preview token', function () {
    $a = Post::factory()->create();
    $b = Post::factory()->create();

    expect($a->preview_token)->toHaveLength(40)
        ->and($b->preview_token)->not->toBe($a->preview_token);
});

it('never sends the token on a public read, but does to the admin', function () {
    $post = Post::factory()->create();

    $this->getJson("/api/posts/{$post->id}")->assertOk()->assertJsonMissingPath('data.preview_token');
    $this->getJson('/api/posts')->assertOk()->assertDontSee($post->preview_token);

    $this->actingAsAdmin();
    $this->getJson("/api/admin/posts/{$post->id}")->assertOk()
        ->assertJsonPath('data.preview_token', $post->preview_token);
});

it('lists drafts only, with their tokens, for the build', function () {
    $draft = Post::factory()->draft()->create();
    $published = Post::factory()->create();

    $res = $this->getJson('/api/internal/post-previews')->assertOk();

    expect(collect($res->json('data'))->pluck('id')->all())->toBe([$draft->id]);
    $res->assertJsonPath('data.0.preview_token', $draft->preview_token)
        ->assertJsonPath('data.0.published_at', null);
    expect($published->id)->not->toBeIn(collect($res->json('data'))->pluck('id')->all());
});

it('refuses the draft list to anything that came through the proxy', function () {
    Post::factory()->draft()->create();

    $this->withHeader('X-Forwarded-For', '203.0.113.9')
        ->getJson('/api/internal/post-previews')->assertNotFound();
    $this->withHeader('X-Forwarded-Host', 'example.com')
        ->getJson('/api/internal/post-previews')->assertNotFound();
});

it('keeps the token when a post is updated', function () {
    $this->actingAsAdmin();
    $post = Post::factory()->draft()->create();
    $token = $post->preview_token;

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed'], 'preview_token' => 'hijack'])->assertOk();

    expect($post->fresh()->preview_token)->toBe($token);
});

it('puts the token on draft rows of the admin list only', function () {
    $draft = Post::factory()->draft()->create();
    $published = Post::factory()->create();

    $this->actingAsAdmin();
    $rows = collect($this->getJson('/api/admin/posts')->assertOk()->json('data'))->keyBy('id');

    expect($rows[$draft->id]['preview_token'])->toBe($draft->preview_token)
        ->and($rows[$published->id])->not->toHaveKey('preview_token');
});

it('keeps the token from a member-role user, who may not read drafts', function () {
    $post = Post::factory()->create();
    Passport::actingAs(User::factory()->create(['role' => 'member']));

    $this->getJson("/api/posts/{$post->id}")->assertOk()->assertJsonMissingPath('data.preview_token');
});

it('refuses post-preview as a module slug, the route it would shadow', function () {
    $this->actingAsAdmin();
    \App\Models\WebsiteModule::create(['slug' => 'posts', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/posts', ['custom_slug' => ['en' => 'post-preview']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('custom_slug.en');
    $this->putJson('/api/admin/modules/posts', ['custom_slug' => ['en' => 'news']])->assertOk();
});
