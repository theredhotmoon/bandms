<?php

use App\Models\Instrument;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/instruments ──────────────────────────────────────────────────────

describe('GET /api/instruments', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/instruments')->assertSuccessful();
    });

    it('returns instruments ordered by category then name', function () {
        Instrument::create(['name' => 'Trumpet',  'category' => 'Brass']);
        Instrument::create(['name' => 'Accordion', 'category' => 'Keys']);
        Instrument::create(['name' => 'Trombone', 'category' => 'Brass']);

        $data = $this->getJson('/api/instruments')->assertSuccessful()->json();

        // Brass items come before Keys
        $names = array_column($data, 'name');
        expect($names[0])->toBe('Trombone');
        expect($names[1])->toBe('Trumpet');
        expect($names[2])->toBe('Accordion');
    });
});

// ── POST /api/instruments ─────────────────────────────────────────────────────

describe('POST /api/instruments', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/instruments', ['name' => 'Guitar'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/instruments', ['name' => 'Guitar'])->assertForbidden();
    });

    it('creates an instrument', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => 'Bass Guitar', 'category' => 'Strings'])
            ->assertCreated()
            ->assertJsonPath('name', 'Bass Guitar')
            ->assertJsonPath('category', 'Strings');

        $this->assertDatabaseHas('instruments', ['name' => 'Bass Guitar']);
    });

    it('creates an instrument without a category', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => 'Theremin'])
            ->assertCreated()
            ->assertJsonPath('category', null);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['category' => 'Strings'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name must be unique', function () {
        $this->actingAsAdmin();
        Instrument::create(['name' => 'Guitar']);

        $this->postJson('/api/instruments', ['name' => 'Guitar'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });
});

// ── PUT /api/instruments/{instrument} ─────────────────────────────────────────

describe('PUT /api/instruments/{instrument}', function () {
    it('returns 401 without authentication', function () {
        $instrument = Instrument::create(['name' => 'Flute']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => 'Piccolo'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $instrument = Instrument::create(['name' => 'Flute']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => 'Piccolo'])->assertForbidden();
    });

    it('updates an instrument', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Flute', 'category' => 'Woodwind']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => 'Piccolo', 'category' => 'Woodwind'])
            ->assertSuccessful()
            ->assertJsonPath('name', 'Piccolo');
    });

    it('allows keeping the same name on update', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Drums']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => 'Drums'])->assertSuccessful();
    });

    it('returns 404 for a non-existent instrument', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/instruments/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/instruments/{instrument} ──────────────────────────────────────

describe('DELETE /api/instruments/{instrument}', function () {
    it('returns 401 without authentication', function () {
        $instrument = Instrument::create(['name' => 'Flute']);

        $this->deleteJson("/api/instruments/{$instrument->id}")->assertUnauthorized();
    });

    it('deletes an instrument', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Gone Instrument']);

        $this->deleteJson("/api/instruments/{$instrument->id}")->assertNoContent();

        $this->assertDatabaseMissing('instruments', ['id' => $instrument->id]);
    });

    it('returns 404 for a non-existent instrument', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/instruments/9999')->assertNotFound();
    });
});
