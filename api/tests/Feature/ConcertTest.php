<?php

namespace Tests\Feature;

use App\Models\Band;
use App\Models\Concert;
use App\Models\Venue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConcertTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_concerts_with_venue_and_bands(): void
    {
        $venue   = Venue::factory()->create(['name' => 'The Stage']);
        $band    = Band::factory()->create(['name' => 'Support Act']);
        $concert = Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2026-08-15']);
        $concert->bands()->attach($band);

        $response = $this->getJson('/api/concerts')->assertOk();

        $response->assertJsonPath('data.0.venue.name', 'The Stage');
        $response->assertJsonPath('data.0.bands.0.name', 'Support Act');
    }

    public function test_index_is_publicly_accessible(): void
    {
        $this->getJson('/api/concerts')->assertOk();
    }

    public function test_index_returns_concerts_sorted_by_date_then_time(): void
    {
        $venue = Venue::factory()->create();
        Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2026-10-01', 'time' => '20:00']);
        Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2026-08-01', 'time' => null]);
        Concert::factory()->create(['venue_id' => $venue->id, 'date' => '2026-10-01', 'time' => '18:00']);

        $response = $this->getJson('/api/concerts')->assertOk();

        $this->assertEquals('2026-08-01', $response->json('data.0.date'));
        $this->assertEquals('18:00', $response->json('data.1.time'));
        $this->assertEquals('20:00', $response->json('data.2.time'));
    }

    public function test_store_creates_concert_with_bands(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();
        $band1 = Band::factory()->create();
        $band2 = Band::factory()->create();

        $payload = [
            'venue_id'    => $venue->id,
            'date'        => '2026-09-20',
            'time'        => '20:00',
            'description' => 'Big summer gig',
            'band_ids'    => [$band1->id, $band2->id],
        ];

        $response = $this->postJson('/api/concerts', $payload)->assertCreated();

        $response->assertJsonPath('data.date', '2026-09-20');
        $response->assertJsonPath('data.time', '20:00');
        $response->assertJsonPath('data.description', 'Big summer gig');
        $this->assertCount(2, $response->json('data.bands'));
        $this->assertDatabaseHas('concert_band', ['band_id' => $band1->id]);
    }

    public function test_store_creates_concert_without_optional_fields(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', [
            'venue_id' => $venue->id,
            'date'     => '2026-12-31',
        ])->assertCreated()
            ->assertJsonPath('data.time', null)
            ->assertJsonPath('data.description', null);
    }

    public function test_store_requires_authentication(): void
    {
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-06-01'])
            ->assertUnauthorized();
    }

    public function test_store_validates_required_venue_id(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/concerts', ['date' => '2026-06-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['venue_id']);
    }

    public function test_store_validates_venue_exists(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/concerts', ['venue_id' => 9999, 'date' => '2026-06-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['venue_id']);
    }

    public function test_store_validates_required_date(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_store_validates_date_format(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '20-06-2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_store_validates_time_format(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2026-06-01', 'time' => '8pm'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['time']);
    }

    public function test_store_validates_band_ids_exist(): void
    {
        $this->actingAsUser();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', [
            'venue_id' => $venue->id,
            'date'     => '2026-06-01',
            'band_ids' => [9999],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['band_ids.0']);
    }

    public function test_show_returns_concert_with_relations(): void
    {
        $venue   = Venue::factory()->create(['name' => 'Jazz Lounge']);
        $band    = Band::factory()->create(['name' => 'Opening Act']);
        $concert = Concert::factory()->create(['venue_id' => $venue->id]);
        $concert->bands()->attach($band);

        $this->getJson("/api/concerts/{$concert->id}")
            ->assertOk()
            ->assertJsonPath('data.venue.name', 'Jazz Lounge')
            ->assertJsonPath('data.bands.0.name', 'Opening Act');
    }

    public function test_show_returns_404_for_missing_concert(): void
    {
        $this->getJson('/api/concerts/9999')->assertNotFound();
    }

    public function test_update_changes_date_and_description(): void
    {
        $this->actingAsUser();
        $concert = Concert::factory()->create(['date' => '2026-06-01', 'description' => 'Old']);

        $this->putJson("/api/concerts/{$concert->id}", [
            'date'        => '2026-07-04',
            'description' => 'New desc',
        ])->assertOk()
            ->assertJsonPath('data.date', '2026-07-04')
            ->assertJsonPath('data.description', 'New desc');
    }

    public function test_update_syncs_bands(): void
    {
        $this->actingAsUser();
        $concert = Concert::factory()->create();
        $old     = Band::factory()->create();
        $new     = Band::factory()->create();
        $concert->bands()->attach($old);

        $this->putJson("/api/concerts/{$concert->id}", ['band_ids' => [$new->id]])
            ->assertOk();

        $this->assertDatabaseMissing('concert_band', ['concert_id' => $concert->id, 'band_id' => $old->id]);
        $this->assertDatabaseHas('concert_band', ['concert_id' => $concert->id, 'band_id' => $new->id]);
    }

    public function test_update_clears_bands_when_empty_array_sent(): void
    {
        $this->actingAsUser();
        $concert = Concert::factory()->create();
        $band    = Band::factory()->create();
        $concert->bands()->attach($band);

        $this->putJson("/api/concerts/{$concert->id}", ['band_ids' => []])->assertOk();

        $this->assertDatabaseMissing('concert_band', ['concert_id' => $concert->id]);
    }

    public function test_update_requires_authentication(): void
    {
        $concert = Concert::factory()->create();

        $this->putJson("/api/concerts/{$concert->id}", ['date' => '2026-07-01'])->assertUnauthorized();
    }

    public function test_destroy_deletes_concert_and_pivot_rows(): void
    {
        $this->actingAsUser();
        $concert = Concert::factory()->create();
        $band    = Band::factory()->create();
        $concert->bands()->attach($band);

        $this->deleteJson("/api/concerts/{$concert->id}")->assertNoContent();

        $this->assertDatabaseMissing('concerts', ['id' => $concert->id]);
        $this->assertDatabaseMissing('concert_band', ['concert_id' => $concert->id]);
    }

    public function test_destroy_requires_authentication(): void
    {
        $concert = Concert::factory()->create();

        $this->deleteJson("/api/concerts/{$concert->id}")->assertUnauthorized();
    }

    public function test_destroy_returns_404_for_missing_concert(): void
    {
        $this->actingAsUser();

        $this->deleteJson('/api/concerts/9999')->assertNotFound();
    }
}
