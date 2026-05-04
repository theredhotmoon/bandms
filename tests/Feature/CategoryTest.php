<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_categories_ordered_by_name(): void
    {
        Category::factory()->create(['name' => 'Rock', 'slug' => 'rock']);
        Category::factory()->create(['name' => 'Blues', 'slug' => 'blues']);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Blues');
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/categories')->assertOk();
    }

    public function test_store_creates_category_and_generates_slug(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/categories', ['name' => 'Heavy Metal'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Heavy Metal')
            ->assertJsonPath('data.slug', 'heavy-metal');

        $this->assertDatabaseHas('categories', ['name' => 'Heavy Metal', 'slug' => 'heavy-metal']);
    }

    public function test_store_makes_slug_unique_when_name_collides(): void
    {
        $this->actingAsUser();
        Category::factory()->create(['name' => 'Metal', 'slug' => 'metal']);

        // Different name but same slug would collide — use exact same name to trigger unique
        $this->postJson('/api/categories', ['name' => 'Metal'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/categories', ['name' => 'Test'])->assertUnauthorized();
    }

    public function test_store_validates_required_name(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/categories', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_show_returns_category(): void
    {
        $cat = Category::factory()->create(['name' => 'Jazz', 'slug' => 'jazz']);

        $this->getJson("/api/categories/{$cat->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Jazz')
            ->assertJsonPath('data.slug', 'jazz');
    }

    public function test_show_returns_404_for_missing_category(): void
    {
        $this->getJson('/api/categories/9999')->assertNotFound();
    }

    public function test_update_renames_category_and_regenerates_slug(): void
    {
        $this->actingAsUser();
        $cat = Category::factory()->create(['name' => 'Old', 'slug' => 'old']);

        $this->putJson("/api/categories/{$cat->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.slug', 'new-name');
    }

    public function test_update_ignores_own_name_for_unique_check(): void
    {
        $this->actingAsUser();
        $cat = Category::factory()->create(['name' => 'Rock', 'slug' => 'rock']);

        $this->putJson("/api/categories/{$cat->id}", ['name' => 'Rock'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Rock');
    }

    public function test_update_requires_authentication(): void
    {
        $cat = Category::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->putJson("/api/categories/{$cat->id}", ['name' => 'Y'])->assertUnauthorized();
    }

    public function test_destroy_deletes_category(): void
    {
        $this->actingAsUser();
        $cat = Category::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/categories/{$cat->id}")->assertNoContent();

        $this->assertDatabaseMissing('categories', ['id' => $cat->id]);
    }

    public function test_destroy_detaches_from_posts_but_keeps_posts(): void
    {
        $this->actingAsUser();
        $cat  = Category::factory()->create(['name' => 'X', 'slug' => 'x']);
        $post = Post::factory()->create();
        $post->categories()->attach($cat);

        $this->deleteJson("/api/categories/{$cat->id}")->assertNoContent();

        $this->assertDatabaseMissing('post_category', ['category_id' => $cat->id]);
        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $cat = Category::factory()->create(['name' => 'X', 'slug' => 'x']);

        $this->deleteJson("/api/categories/{$cat->id}")->assertUnauthorized();
    }
}
