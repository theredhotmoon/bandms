<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Tag;

/**
 * posts.content_updated_at: what search engines are told as the article's
 * modified date, so it must move with the article and with nothing else.
 */
beforeEach(function () {
    $this->actingAsAdmin();
    $this->travelTo('2026-11-24 10:00:00');

    $this->post = Post::factory()->published()->create(['title' => ['en' => 'Title', 'pl' => 'Tytuł'], 'intro' => ['en' => 'Intro']]);
    PostBlock::factory()->for($this->post)->text('Body')->create(['position' => 0]);

    $this->save = fn (array $data) => $this->putJson("/api/posts/{$this->post->id}", $data)->assertSuccessful();
    $this->stamp = fn () => $this->post->fresh()->content_updated_at?->toDateTimeString();
    $this->body = fn () => $this->post->blocks()->get()->map(fn ($b) => ['type' => $b->type, 'payload' => $b->payload])->all();
});

it('is null until the article changes', function () {
    expect(($this->stamp)())->toBeNull();
    $this->getJson("/api/posts/{$this->post->id}")->assertJsonPath('data.content_updated_at', null);
});

it('moves with the title, the intro and the body', function (array $data) {
    ($this->save)($data);

    expect(($this->stamp)())->toBe('2026-11-24 10:00:00');
    $this->getJson("/api/posts/{$this->post->id}")
        ->assertJsonPath('data.content_updated_at', '2026-11-24T10:00:00.000000Z');
})->with([
    'title'         => [['title' => ['en' => 'New title', 'pl' => 'Tytuł']]],
    'one language'  => [['title' => ['en' => 'Title', 'pl' => 'Nowy']]],
    'intro'         => [['title' => ['en' => 'Title', 'pl' => 'Tytuł'], 'intro' => ['en' => 'New intro']]],
    'body text'     => [['title' => ['en' => 'Title', 'pl' => 'Tytuł'], 'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'New body']]]]]],
    'body removed'  => [['title' => ['en' => 'Title', 'pl' => 'Tytuł'], 'blocks' => []]],
]);

// The form resends everything on every save, in the band's language order and
// with blank languages as null.
it('stays when the same article is saved again', function () {
    ($this->save)([
        'title'  => ['pl' => 'Tytuł', 'en' => 'Title'],
        'intro'  => ['pl' => null, 'en' => 'Intro'],
        'blocks' => ($this->body)(),
    ]);

    expect(($this->stamp)())->toBeNull();
});

// An unlabelled embed or picture is stored without the bag, or with null; the
// form sends one back blank in every language.
it('stays when a blank label comes back as an empty bag', function (array $stored) {
    $this->post->blocks()->delete();
    $embed = ['url' => 'https://youtu.be/dQw4w9WgXcQ', 'provider' => 'youtube'];
    PostBlock::create(['post_id' => $this->post->id, 'position' => 0, 'type' => 'embed', 'payload' => [...$embed, ...$stored]]);

    ($this->save)([
        'title'  => ['en' => 'Title', 'pl' => 'Tytuł'],
        'blocks' => [['type' => 'embed', 'payload' => [...$embed, 'label' => ['en' => null, 'pl' => null]]]],
    ]);

    expect(($this->stamp)())->toBeNull();
})->with(['null' => [['label' => null]], 'absent' => [[]]]);

it('stays when only the surroundings change', function () {
    ($this->save)([
        'title'            => ['en' => 'Title', 'pl' => 'Tytuł'],
        'tag_ids'          => [Tag::factory()->create()->id],
        'comments_enabled' => false,
    ]);
    $this->putJson("/api/posts/{$this->post->id}/highlight", ['highlighted' => true])->assertSuccessful();

    expect(($this->stamp)())->toBeNull();
});

it('ignores writing a draft and publishing it', function () {
    $draft = Post::factory()->draft()->create(['title' => ['en' => 'Draft']]);

    $this->putJson("/api/posts/{$draft->id}", ['title' => ['en' => 'Better draft']])->assertSuccessful();
    $this->putJson("/api/posts/{$draft->id}", ['title' => ['en' => 'Final'], 'published_at' => '2026-11-24 09:00:00'])->assertSuccessful();

    expect($draft->fresh()->content_updated_at)->toBeNull();
});

it('is not a field anyone can send', function () {
    ($this->save)(['title' => ['en' => 'Title', 'pl' => 'Tytuł'], 'content_updated_at' => '2030-01-01 00:00:00']);

    expect(($this->stamp)())->toBeNull();
});

// A deadlock rolls the save back; the model must not believe it happened.
it('still saves the edit and its date when the transaction is retried', function () {
    rerunTransactions();

    ($this->save)(['title' => ['en' => 'Retried', 'pl' => 'Tytuł']]);

    expect($this->post->fresh()->getTranslation('title', 'en'))->toBe('Retried')
        ->and(($this->stamp)())->toBe('2026-11-24 10:00:00');
});
