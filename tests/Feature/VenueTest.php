<?php

namespace Tests\Feature;

use App\Models\Venue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VenueTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_all_venues_ordered_by_name(): void
    {
        Venue::factory()->create(['name' => 'Zebra Club']);
        Venue::factory()->create(['name' => 'Alpha Hall']);

        $this->getJson('/api/venues')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Hall');
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/venues')->assertOk();
    }

    public function test_store_creates_venue_with_all_fields(): void
    {
        $this->actingAsUser();

        $payload = [
            'name'      => 'Rock Arena',
            'address'   => 'ul. Główna 1, Warszawa',
            'latitude'  => 52.2297,
            'longitude' => 21.0122,
        ];

        $this->postJson('/api/venues', $payload)
            ->assertCreated()
            ->assertJsonPath('data.name', 'Rock Arena')
            ->assertJsonPath('data.address', 'ul. Główna 1, Warszawa')
            ->assertJsonPath('data.latitude', 52.2297)
            ->assertJsonPath('data.longitude', 21.0122);

        $this->assertDatabaseHas('venues', ['name' => 'Rock Arena']);
    }

    public function test_store_creates_venue_without_optional_fields(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/venues', ['name' => 'Minimal Venue'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Minimal Venue')
            ->assertJsonPath('data.latitude', null);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/venues', ['name' => 'Test'])->assertUnauthorized();
    }

    public function test_store_validates_required_name(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/venues', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_validates_latitude_range(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/venues', ['name' => 'Bad Lat', 'latitude' => 91.0, 'longitude' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude']);
    }

    public function test_store_validates_longitude_range(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/venues', ['name' => 'Bad Lng', 'latitude' => 0, 'longitude' => 181.0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['longitude']);
    }

    public function test_show_returns_venue(): void
    {
        $venue = Venue::factory()->create(['name' => 'My Stage']);

        $this->getJson("/api/venues/{$venue->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'My Stage');
    }

    public function test_show_returns_404_for_missing_venue(): void
    {
        $this->getJson('/api/venues/9999')->assertNotFound();
    }

    public function test_update_modifies_venue(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create(['name' => 'Old Name']);

        $this->putJson("/api/venues/{$venue->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('venues', ['id' => $venue->id, 'name' => 'New Name']);
    }

    public function test_update_requires_authentication(): void
    {
        $venue = Venue::factory()->create();

        $this->putJson("/api/venues/{$venue->id}", ['name' => 'X'])->assertUnauthorized();
    }

    public function test_update_clears_coordinates_when_null_sent(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create(['latitude' => 50.0, 'longitude' => 20.0]);

        $this->putJson("/api/venues/{$venue->id}", [
            'name'      => $venue->name,
            'latitude'  => null,
            'longitude' => null,
        ])->assertOk()
            ->assertJsonPath('data.latitude', null);
    }

    public function test_destroy_deletes_venue(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->deleteJson("/api/venues/{$venue->id}")->assertNoContent();

        $this->assertDatabaseMissing('venues', ['id' => $venue->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $venue = Venue::factory()->create();

        $this->deleteJson("/api/venues/{$venue->id}")->assertUnauthorized();
    }

    public function test_destroy_returns_404_for_missing_venue(): void
    {
        $this->actingAsUser();

        $this->deleteJson('/api/venues/9999')->assertNotFound();
    }
}
