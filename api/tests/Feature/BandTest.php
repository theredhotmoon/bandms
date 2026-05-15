<?php

namespace Tests\Feature;

use App\Models\Band;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BandTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_all_bands_ordered_by_name(): void
    {
        Band::factory()->create(['name' => 'Zebra Band']);
        Band::factory()->create(['name' => 'Alpha Wolves']);

        $this->getJson('/api/bands')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Wolves');
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/bands')->assertOk();
    }

    public function test_index_returns_empty_collection_when_no_bands(): void
    {
        $this->getJson('/api/bands')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_store_creates_band(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/bands', ['name' => 'Iron Fist'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Iron Fist');

        $this->assertDatabaseHas('bands', ['name' => 'Iron Fist']);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/bands', ['name' => 'Test'])->assertUnauthorized();
    }

    public function test_store_validates_required_name(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/bands', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_validates_name_max_length(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/bands', ['name' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_show_returns_band(): void
    {
        $band = Band::factory()->create(['name' => 'Steel Panda']);

        $this->getJson("/api/bands/{$band->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Steel Panda');
    }

    public function test_show_returns_404_for_missing_band(): void
    {
        $this->getJson('/api/bands/9999')->assertNotFound();
    }

    public function test_update_renames_band(): void
    {
        $this->actingAsUser();
        $band = Band::factory()->create(['name' => 'Old Name']);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('bands', ['id' => $band->id, 'name' => 'New Name']);
    }

    public function test_update_requires_authentication(): void
    {
        $band = Band::factory()->create();

        $this->putJson("/api/bands/{$band->id}", ['name' => 'X'])->assertUnauthorized();
    }

    public function test_update_validates_required_name(): void
    {
        $this->actingAsUser();
        $band = Band::factory()->create();

        $this->putJson("/api/bands/{$band->id}", ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_destroy_deletes_band(): void
    {
        $this->actingAsUser();
        $band = Band::factory()->create();

        $this->deleteJson("/api/bands/{$band->id}")->assertNoContent();

        $this->assertDatabaseMissing('bands', ['id' => $band->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $band = Band::factory()->create();

        $this->deleteJson("/api/bands/{$band->id}")->assertUnauthorized();
    }

    public function test_destroy_returns_404_for_missing_band(): void
    {
        $this->actingAsUser();

        $this->deleteJson('/api/bands/9999')->assertNotFound();
    }
}
