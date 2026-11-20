<?php

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Post;
use Illuminate\Support\Facades\DB;

// "Link to… → Videos" on a post writes `clip_ids`; the post becomes a clip
// owner through `clippables` (alias `post`), and the public article lists the
// clips at its foot.

beforeEach(fn () => $this->createProfile());

it('links clips on create, in the order given, and serves them', function () {
    $this->actingAsAdmin();
    [$a, $b] = [Clip::factory()->create(), Clip::factory()->create()];

    $id = $this->postJson('/api/posts', $this->validPost([
        'title'    => ['en' => 'Tour diary'],
        'published_at' => now()->subHour()->toDateTimeString(),
        'clip_ids' => [$b->id, $a->id],
    ]))->assertCreated()
        ->assertJsonPath('data.clip_ids', [$b->id, $a->id])
        ->assertJsonPath('data.clips.0.id', $b->id)
        ->json('data.id');

    expect(Post::find($id)->clips()->pluck('clips.id')->all())->toBe([$b->id, $a->id]);
    expect(DB::table('clippables')->where('clippable_type', 'post')->count())->toBe(2);

    // The public detail carries them too — that is what the article renders.
    $this->getJson("/api/posts/{$id}")->assertOk()->assertJsonCount(2, 'data.clips');
});

it('replaces on update, leaves alone when absent, clears with []', function () {
    $this->actingAsAdmin();
    [$a, $b] = [Clip::factory()->create(), Clip::factory()->create()];
    $post = Post::factory()->create();
    $post->clips()->sync([$a->id => ['position' => 0]]);

    $this->putJson("/api/posts/{$post->id}", ['clip_ids' => [$b->id]])->assertOk();
    expect($post->clips()->pluck('clips.id')->all())->toBe([$b->id]);

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])->assertOk();
    expect($post->clips()->pluck('clips.id')->all())->toBe([$b->id]);

    $this->putJson("/api/posts/{$post->id}", ['clip_ids' => []])
        ->assertOk()->assertJsonPath('data.clip_ids', []);
});

it('rejects an unknown clip id', function () {
    $this->actingAsAdmin();

    $this->postJson('/api/posts', $this->validPost(['title' => ['en' => 'x'], 'clip_ids' => [999999]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('clip_ids.0');
});

it('lists the post among the clip owners, and a clip save that sends it back keeps it', function () {
    $this->actingAsAdmin();
    $clip = Clip::factory()->create();
    $post = Post::factory()->create(['title' => ['en' => 'Tour diary']]);
    $concert = Concert::factory()->create();
    $post->clips()->sync([$clip->id => ['position' => 0]]);

    $owners = $this->getJson('/api/clips')->assertOk()->json('data.0.owners');
    expect($owners)->toContain(['type' => 'post', 'id' => $post->id, 'label' => 'Tour diary']);

    // The admin's clip form resends owners it has no picker for.
    $this->putJson("/api/clips/{$clip->id}", [
        'attach' => [['type' => 'concert', 'id' => $concert->id], ['type' => 'post', 'id' => $post->id]],
    ])->assertOk();

    expect($post->clips()->pluck('clips.id')->all())->toBe([$clip->id]);
});

it('detaches its clips when the post is deleted', function () {
    $this->actingAsAdmin();
    $clip = Clip::factory()->create();
    $post = Post::factory()->create();
    $post->clips()->sync([$clip->id => ['position' => 0]]);

    $this->deleteJson("/api/posts/{$post->id}")->assertSuccessful();

    expect(DB::table('clippables')->where('clippable_type', 'post')->count())->toBe(0);
    expect(Clip::find($clip->id))->not->toBeNull();
});
