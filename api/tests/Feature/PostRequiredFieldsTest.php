<?php

use App\Models\Post;
use App\Models\Tag;

// Title, intro and at least one tag are required for every post — a draft
// included, because the draft is the record that later goes live.

describe('fields every post needs', function () {
    beforeEach(function () {
        $this->createProfile();
        $this->actingAsAdmin();
    });

    it('refuses a draft with no intro and no tag', function () {
        $this->postJson('/api/posts', ['title' => ['en' => 'Draft'], 'published_at' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['intro', 'tag_ids']);
    });

    it('refuses an intro or title that is blank in every language', function () {
        $this->postJson('/api/posts', [
            'title'   => ['en' => '  ', 'pl' => null],
            'intro'   => ['en' => null, 'pl' => ''],
            'tag_ids' => [Tag::factory()->create()->id],
        ])->assertUnprocessable()->assertJsonValidationErrors(['title', 'intro']);
    });

    it('refuses an empty tag list', function () {
        $this->postJson('/api/posts', [
            'title' => ['en' => 'T'], 'intro' => ['en' => 'I'], 'tag_ids' => [],
        ])->assertUnprocessable()->assertJsonValidationErrors('tag_ids');
    });

    it('accepts a draft written in one language only, and generates its slug', function () {
        $tag = Tag::factory()->create();

        $this->postJson('/api/posts', [
            'title' => ['pl' => 'Tylko po polsku'], 'intro' => ['pl' => 'Wstęp'], 'tag_ids' => [$tag->id],
        ])->assertCreated()->assertJsonPath('data.slug', 'tylko-po-polsku');
    });

    it('lets a partial update leave the required fields out', function () {
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['published_at' => null])->assertOk();
    });

    it('refuses an update that clears the tags', function () {
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['tag_ids' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('tag_ids');
    });
});
