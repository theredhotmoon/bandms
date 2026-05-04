<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TagTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_tags_ordered_by_name(): void
    {
        Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);
        Tag::factory()->create(['name' => 'Acoustic', 'slug' => 'acoustic']);

        $this->getJson('/api/tags')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Acoustic');
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/tags')->assertOk();
    }

    public function test_store_creates_tag_and_generates_slug(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/tags', ['name' => 'Live Music'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Live Music')
            ->assertJsonPath('data.slug', 'live-music');
    }

    public function test_store_rejects_duplicate_name(): void
    {
        $this->actingAsUser();
        Tag::factory()->create(['name' => 'Metal', 'slug' => 'metal']);

        $this->postJson('/api/tags', ['name' => 'Metal'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/tags', ['name' => 'Test'])->assertUnauthorized();
    }

    public function test_show_returns_tag(): void
    {
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug' => 'blues']);

        $this->getJson("/api/tags/{$tag->id}")
            ->assertOk()
            ->assertJsonPath('data.slug', 'blues');
    }

    public function test_show_returns_404_for_missing_tag(): void
    {
        $this->getJson('/api/tags/9999')->assertNotFound();
    }

    public function test_update_renames_tag_and_updates_slug(): void
    {
        $this->actingAsUser();
        $tag = Tag::factory()->create(['name' => 'Old', 'slug' => 'old']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.slug', 'new-name');
    }

    public function test_update_ignores_own_name_for_unique_check(): void
    {
        $this->actingAsUser();
        $tag = Tag::factory()->create(['name' => 'Blues', 'slug' => 'blues']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'Blues'])->assertOk();
    }

    public function test_update_requires_authentication(): void
    {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => 'Y'])->assertUnauthorized();
    }

    public function test_destroy_deletes_tag(): void
    {
        $this->actingAsUser();
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertNoContent();

        $this->assertDatabaseMissing('tags', ['id' => $tag->id]);
    }

    public function test_destroy_detaches_from_posts_but_keeps_posts(): void
    {
        $this->actingAsUser();
        $tag  = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);
        $post = Post::factory()->create();
        $post->tags()->attach($tag);

        $this->deleteJson("/api/tags/{$tag->id}")->assertNoContent();

        $this->assertDatabaseMissing('post_tag', ['tag_id' => $tag->id]);
        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $tag = Tag::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/tags/{$tag->id}")->assertUnauthorized();
    }
}
