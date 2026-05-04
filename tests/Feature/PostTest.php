<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// 1x1 transparent PNG encoded as base64 data URL — used as a safe test image fixture.
const TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

class PostTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_posts_without_image(): void
    {
        Post::factory()->create(['title' => 'Hello World', 'image' => TEST_IMAGE]);

        $response = $this->getJson('/api/posts')->assertOk();

        $this->assertArrayNotHasKey('image', $response->json('data.0'));
        $this->assertArrayHasKey('excerpt', $response->json('data.0'));
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/posts')->assertOk();
    }

    public function test_index_returns_posts_newest_first(): void
    {
        Post::factory()->create(['title' => 'Older', 'published_at' => now()->subDays(5)]);
        Post::factory()->create(['title' => 'Newer', 'published_at' => now()]);

        $this->getJson('/api/posts')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Newer');
    }

    public function test_index_search_filters_by_title(): void
    {
        Post::factory()->create(['title' => 'Guitar Lessons Review']);
        Post::factory()->create(['title' => 'Drum Kit Advice']);

        $this->getJson('/api/posts?search=guitar')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Guitar Lessons Review');
    }

    public function test_index_search_filters_by_content(): void
    {
        Post::factory()->create(['title' => 'Post A', 'content' => 'We talked about amplifiers']);
        Post::factory()->create(['title' => 'Post B', 'content' => 'Nothing interesting here']);

        $this->getJson('/api/posts?search=amplifiers')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Post A');
    }

    public function test_index_filters_by_category(): void
    {
        $cat  = Category::factory()->create(['name' => 'Rock', 'slug' => 'rock']);
        $post = Post::factory()->create(['title' => 'Rock Post']);
        Post::factory()->create(['title' => 'Other Post']);
        $post->categories()->attach($cat);

        $this->getJson("/api/posts?category_id={$cat->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Rock Post');
    }

    public function test_index_filters_by_tag(): void
    {
        $tag  = Tag::factory()->create(['name' => 'Live', 'slug' => 'live']);
        $post = Post::factory()->create(['title' => 'Live Show']);
        Post::factory()->create(['title' => 'Studio Notes']);
        $post->tags()->attach($tag);

        $this->getJson("/api/posts?tag_id={$tag->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Live Show');
    }

    public function test_index_includes_categories_and_tags(): void
    {
        $cat  = Category::factory()->create(['name' => 'Jazz', 'slug' => 'jazz']);
        $tag  = Tag::factory()->create(['name' => 'Acoustic', 'slug' => 'acoustic']);
        $post = Post::factory()->create();
        $post->categories()->attach($cat);
        $post->tags()->attach($tag);

        $response = $this->getJson('/api/posts')->assertOk();

        $this->assertEquals('Jazz', $response->json('data.0.categories.0.name'));
        $this->assertEquals('Acoustic', $response->json('data.0.tags.0.name'));
    }

    public function test_store_creates_post_with_all_fields(): void
    {
        $this->actingAsUser();
        $cat = Category::factory()->create(['name' => 'Rock', 'slug' => 'rock']);
        $tag = Tag::factory()->create(['name' => 'Live', 'slug' => 'live']);

        $payload = [
            'title'        => 'My First Post',
            'content'      => 'Some great content here.',
            'image'        => TEST_IMAGE,
            'published_at' => '2026-06-01 20:00:00',
            'category_ids' => [$cat->id],
            'tag_ids'      => [$tag->id],
            'links'        => [
                ['type' => 'youtube', 'url' => 'https://www.youtube.com/watch?v=abc123', 'label' => null],
                ['type' => 'normal',  'url' => 'https://example.com', 'label' => 'Our website'],
            ],
        ];

        $response = $this->postJson('/api/posts', $payload)->assertCreated();

        $response->assertJsonPath('data.title', 'My First Post');
        $response->assertJsonPath('data.image', TEST_IMAGE);
        $this->assertCount(1, $response->json('data.categories'));
        $this->assertCount(1, $response->json('data.tags'));
        $this->assertCount(2, $response->json('data.links'));
        $this->assertEquals('youtube', $response->json('data.links.0.type'));
        $this->assertDatabaseHas('posts', ['title' => 'My First Post']);
    }

    public function test_store_generates_slug_from_title(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', ['title' => 'Hello World Post'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'hello-world-post');
    }

    public function test_store_generates_unique_slug_on_collision(): void
    {
        $this->actingAsUser();
        Post::factory()->create(['title' => 'Same Title', 'slug' => 'same-title']);

        $response = $this->postJson('/api/posts', ['title' => 'Same Title'])->assertCreated();

        $this->assertStringStartsWith('same-title-', $response->json('data.slug'));
    }

    public function test_store_creates_draft_when_published_at_is_null(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', ['title' => 'Draft Post'])
            ->assertCreated()
            ->assertJsonPath('data.published_at', null);
    }

    public function test_store_validates_required_title(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    }

    public function test_store_validates_image_must_be_data_url(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', ['title' => 'Post', 'image' => 'not-an-image'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['image']);
    }

    public function test_store_validates_link_type(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', [
            'title' => 'Post',
            'links' => [['type' => 'twitter', 'url' => 'https://twitter.com/x']],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['links.0.type']);
    }

    public function test_store_validates_link_url_format(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/posts', [
            'title' => 'Post',
            'links' => [['type' => 'normal', 'url' => 'not-a-url']],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['links.0.url']);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/posts', ['title' => 'Test'])->assertUnauthorized();
    }

    public function test_show_returns_post_with_image_and_links(): void
    {
        $post = Post::factory()->create(['title' => 'Detail Post', 'image' => TEST_IMAGE]);
        $post->links()->create(['type' => 'facebook', 'url' => 'https://facebook.com/band', 'label' => null, 'sort_order' => 0]);

        $response = $this->getJson("/api/posts/{$post->id}")->assertOk();

        $response->assertJsonPath('data.image', TEST_IMAGE);
        $response->assertJsonPath('data.links.0.type', 'facebook');
    }

    public function test_show_returns_404_for_missing_post(): void
    {
        $this->getJson('/api/posts/9999')->assertNotFound();
    }

    public function test_update_changes_title_and_content(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create(['title' => 'Old Title', 'content' => 'Old content']);

        $this->putJson("/api/posts/{$post->id}", [
            'title'   => 'New Title',
            'content' => 'New content',
        ])->assertOk()
            ->assertJsonPath('data.title', 'New Title')
            ->assertJsonPath('data.content', 'New content');
    }

    public function test_update_does_not_change_image_when_key_absent(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create(['image' => TEST_IMAGE]);

        $this->putJson("/api/posts/{$post->id}", ['title' => 'Updated Title'])->assertOk();

        $this->assertDatabaseHas('posts', ['id' => $post->id, 'title' => 'Updated Title']);
        $this->assertEquals(TEST_IMAGE, $post->fresh()->image);
    }

    public function test_update_clears_image_when_null_sent(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create(['image' => TEST_IMAGE]);

        $this->putJson("/api/posts/{$post->id}", ['image' => null])->assertOk();

        $this->assertNull($post->fresh()->image);
    }

    public function test_update_replaces_links(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create();
        $post->links()->create(['type' => 'youtube', 'url' => 'https://youtube.com/old', 'sort_order' => 0]);

        $this->putJson("/api/posts/{$post->id}", [
            'links' => [['type' => 'instagram', 'url' => 'https://instagram.com/band', 'label' => null]],
        ])->assertOk();

        $this->assertDatabaseMissing('post_links', ['post_id' => $post->id, 'type' => 'youtube']);
        $this->assertDatabaseHas('post_links', ['post_id' => $post->id, 'type' => 'instagram']);
    }

    public function test_update_clears_all_links_when_empty_array_sent(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create();
        $post->links()->create(['type' => 'youtube', 'url' => 'https://youtube.com/x', 'sort_order' => 0]);

        $this->putJson("/api/posts/{$post->id}", ['links' => []])->assertOk();

        $this->assertDatabaseMissing('post_links', ['post_id' => $post->id]);
    }

    public function test_update_syncs_categories_and_tags(): void
    {
        $this->actingAsUser();
        $post    = Post::factory()->create();
        $oldCat  = Category::factory()->create(['name' => 'Old', 'slug' => 'old']);
        $newCat  = Category::factory()->create(['name' => 'New', 'slug' => 'new']);
        $post->categories()->attach($oldCat);

        $this->putJson("/api/posts/{$post->id}", ['category_ids' => [$newCat->id]])->assertOk();

        $this->assertDatabaseMissing('post_category', ['post_id' => $post->id, 'category_id' => $oldCat->id]);
        $this->assertDatabaseHas('post_category', ['post_id' => $post->id, 'category_id' => $newCat->id]);
    }

    public function test_update_requires_authentication(): void
    {
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['title' => 'X'])->assertUnauthorized();
    }

    public function test_destroy_deletes_post_and_links(): void
    {
        $this->actingAsUser();
        $post = Post::factory()->create();
        $post->links()->create(['type' => 'normal', 'url' => 'https://example.com', 'sort_order' => 0]);

        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
        $this->assertDatabaseMissing('post_links', ['post_id' => $post->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $post = Post::factory()->create();

        $this->deleteJson("/api/posts/{$post->id}")->assertUnauthorized();
    }
}
