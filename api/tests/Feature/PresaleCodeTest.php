<?php

use App\Models\Concert;
use App\Models\ConcertTicketPriceTier;
use App\Models\ConcertTicketType;
use App\Models\PresaleCode;
use App\Models\Venue;

// ── POST /api/presale-codes/validate ─────────────────────────────────────────

describe('POST /api/presale-codes/validate', function () {
    it('validates a valid presale code', function () {
        $venue      = Venue::factory()->create();
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);
        $ticketType = ConcertTicketType::create([
            'concert_id' => $concert->id,
            'name'       => 'GA',
            'sort_order' => 0,
        ]);
        $tier = ConcertTicketPriceTier::create([
            'concert_ticket_type_id' => $ticketType->id,
            'name'                   => 'Early Bird',
            'price'                  => 25.00,
            'currency'               => 'PLN',
            'sort_order'             => 0,
        ]);

        $presale = PresaleCode::create([
            'code'        => 'EARLYBIRD',
            'concert_id'  => $concert->id,
            'description' => 'Early bird discount',
        ]);
        $presale->tiers()->attach($tier->id);

        $this->postJson('/api/presale-codes/validate', [
            'code'       => 'EARLYBIRD',
            'concert_id' => $concert->id,
        ])
            ->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('tier_ids.0', $tier->id);
    });

    it('rejects an invalid code', function () {
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        $this->postJson('/api/presale-codes/validate', [
            'code'       => 'WRONGCODE',
            'concert_id' => $concert->id,
        ])
            ->assertOk()
            ->assertJsonPath('valid', false);
    });

    it('rejects an expired code', function () {
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        PresaleCode::create([
            'code'        => 'EXPIRED123',
            'concert_id'  => $concert->id,
            'valid_until' => now()->subDay(),
            'description' => 'Expired promo',
        ]);

        $this->postJson('/api/presale-codes/validate', [
            'code'       => 'EXPIRED123',
            'concert_id' => $concert->id,
        ])
            ->assertOk()
            ->assertJsonPath('valid', false)
            ->assertJsonPath('message', 'Code has expired.');
    });

    it('rejects an exhausted code', function () {
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        PresaleCode::create([
            'code'        => 'MAXEDOUT1',
            'concert_id'  => $concert->id,
            'max_uses'    => 10,
            'used_count'  => 10,
            'description' => 'Maxed out code',
        ]);

        $this->postJson('/api/presale-codes/validate', [
            'code'       => 'MAXEDOUT1',
            'concert_id' => $concert->id,
        ])
            ->assertOk()
            ->assertJsonPath('valid', false)
            ->assertJsonPath('message', 'Code has reached its usage limit.');
    });

    it('validates a global code for any concert', function () {
        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        PresaleCode::create([
            'code'        => 'GLOBALCODE',
            'concert_id'  => null,
            'description' => 'Global promo — all concerts',
        ]);

        $this->postJson('/api/presale-codes/validate', [
            'code'       => 'GLOBALCODE',
            'concert_id' => $concert->id,
        ])
            ->assertOk()
            ->assertJsonPath('valid', true);
    });
});

// ── GET /api/presale-codes ────────────────────────────────────────────────────

describe('GET /api/presale-codes', function () {
    it('lists presale codes — requires auth', function () {
        $this->getJson('/api/presale-codes')->assertUnauthorized();
    });

    it('lists presale codes — admin can list', function () {
        $this->actingAsAdmin();

        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        PresaleCode::create([
            'code'        => 'LISTTEST1',
            'concert_id'  => $concert->id,
            'description' => 'Listed code',
        ]);

        $this->getJson('/api/presale-codes')
            ->assertOk()
            ->assertJsonStructure([['id', 'code', 'concert_id', 'description', 'used_count', 'max_uses', 'tier_ids']]);
    });
});

// ── POST /api/presale-codes ───────────────────────────────────────────────────

describe('POST /api/presale-codes', function () {
    it('creates a single presale code', function () {
        $this->actingAsAdmin();

        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        $response = $this->postJson('/api/presale-codes', [
            'code'        => 'SINGLETST',
            'concert_id'  => $concert->id,
            'description' => 'Single test code',
            'count'       => 1,
        ]);

        $response->assertCreated();

        $data = $response->json();
        expect($data)->toHaveCount(1)
            ->and($data[0]['code'])->toBe('SINGLETST');

        $this->assertDatabaseHas('presale_codes', ['code' => 'SINGLETST']);
    });

    it('bulk generates presale codes', function () {
        $this->actingAsAdmin();

        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        $response = $this->postJson('/api/presale-codes', [
            'concert_id'  => $concert->id,
            'description' => 'Bulk codes',
            'count'       => 5,
        ]);

        $response->assertCreated();

        $data = $response->json();
        expect($data)->toHaveCount(5);

        $this->assertDatabaseCount('presale_codes', 5);
    });
});

// ── DELETE /api/presale-codes/{id} ───────────────────────────────────────────

describe('DELETE /api/presale-codes/{id}', function () {
    it('deletes a presale code', function () {
        $this->actingAsAdmin();

        $venue   = Venue::factory()->create();
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-01']);

        $presale = PresaleCode::create([
            'code'        => 'DELETEME1',
            'concert_id'  => $concert->id,
            'description' => 'To be deleted',
        ]);

        $this->deleteJson("/api/presale-codes/{$presale->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('presale_codes', ['id' => $presale->id]);
    });
});
