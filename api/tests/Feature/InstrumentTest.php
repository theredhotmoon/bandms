<?php

use App\Enums\StagePlotType;
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

        $data = $this->getJson('/api/instruments')->assertSuccessful()->json('data');

        // Brass items come before Keys
        $names = array_column($data, 'name');
        expect($names[0])->toBe('Trombone');
        expect($names[1])->toBe('Trumpet');
        expect($names[2])->toBe('Accordion');
    });

    it('resolves the name for the requested locale, falling back when untranslated', function () {
        Instrument::create(['name' => ['en' => 'Guitar', 'pl' => 'Gitara']]);

        // Only 'en' was ever set for this one — 'pl' falls back rather than
        // rendering an empty row on the public site.
        Instrument::create(['name' => 'Drums']);

        $data = $this->getJson('/api/instruments?lang=pl')->assertSuccessful()->json('data');
        $names = array_column($data, 'name');

        expect($names)->toContain('Gitara');
        expect($names)->toContain('Drums');
    });

    it('includes the raw per-locale translations bag for the admin editor', function () {
        Instrument::create(['name' => ['en' => 'Guitar', 'pl' => 'Gitara']]);

        $data = $this->getJson('/api/instruments')->assertSuccessful()->json('data');

        expect($data[0]['translations']['name'])->toBe(['en' => 'Guitar', 'pl' => 'Gitara']);
    });
});

// ── POST /api/instruments ─────────────────────────────────────────────────────

describe('POST /api/instruments', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/instruments', ['name' => ['en' => 'Guitar']])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/instruments', ['name' => ['en' => 'Guitar']])->assertForbidden();
    });

    it('creates an instrument', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => 'Bass Guitar'], 'category' => 'Strings'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Bass Guitar')
            ->assertJsonPath('data.category', 'Strings');

        $this->assertDatabaseHas('instruments', ['name->en' => 'Bass Guitar']);
    });

    it('creates an instrument without a category', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => 'Theremin']])
            ->assertCreated()
            ->assertJsonPath('data.category', null);
    });

    it('creates a Polish-only instrument', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['pl' => 'Fujarka']])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Fujarka')
            ->assertJsonPath('data.translations.name.en', null);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['category' => 'Strings'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates a name must be filled in at least one language', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => '', 'pl' => '']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en', 'name.pl']);
    });

    it('validates name.en must be unique per locale', function () {
        $this->actingAsAdmin();
        Instrument::create(['name' => 'Guitar']);

        $this->postJson('/api/instruments', ['name' => ['en' => 'Guitar']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en']);
    });

    it('allows the same word in different locales across two instruments', function () {
        $this->actingAsAdmin();
        Instrument::create(['name' => ['en' => 'Live', 'pl' => 'Na żywo']]);

        $this->postJson('/api/instruments', ['name' => ['en' => 'Na żywo']])
            ->assertCreated();
    });

    it('validates name max length', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => str_repeat('a', 101)]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en']);
    });

    it('rejects a name payload with an unregistered locale key', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => 'Guitar', 'de' => 'Gitarre']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('accepts every stage plot type in the enum', function () {
        $this->actingAsAdmin();

        foreach (StagePlotType::values() as $i => $type) {
            $this->postJson('/api/instruments', ['name' => ['en' => "Instrument {$i}"], 'stage_plot_type' => $type])
                ->assertCreated()
                ->assertJsonPath('data.stage_plot_type', $type);
        }
    });

    it('rejects an unknown stage plot type', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => 'Kazoo'], 'stage_plot_type' => 'kazoo'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['stage_plot_type']);
    });

    it('allows a null stage plot type', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/instruments', ['name' => ['en' => 'Theremin'], 'stage_plot_type' => null])
            ->assertCreated()
            ->assertJsonPath('data.stage_plot_type', null);
    });
});

// ── PUT /api/instruments/{instrument} ─────────────────────────────────────────

describe('PUT /api/instruments/{instrument}', function () {
    it('returns 401 without authentication', function () {
        $instrument = Instrument::create(['name' => 'Flute']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Piccolo']])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $instrument = Instrument::create(['name' => 'Flute']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Piccolo']])->assertForbidden();
    });

    it('updates an instrument', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Flute', 'category' => 'Woodwind']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Piccolo'], 'category' => 'Woodwind'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Piccolo');
    });

    it('allows keeping the same name on update', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Drums']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Drums']])->assertSuccessful();
    });

    it('updates only the given locale, leaving the other untouched', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => ['en' => 'Guitar', 'pl' => 'Gitara']]);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Electric Guitar']])
            ->assertSuccessful()
            ->assertJsonPath('data.translations.name.en', 'Electric Guitar')
            ->assertJsonPath('data.translations.name.pl', 'Gitara');
    });

    it('clears one locale via an explicit empty string without wiping the other', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => ['en' => 'Guitar', 'pl' => 'Gitara']]);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Guitar', 'pl' => '']])
            ->assertSuccessful()
            ->assertJsonPath('data.translations.name.pl', null);
    });

    it('validates name must not be empty in every language when provided', function () {
        $this->actingAsAdmin();
        $instrument = Instrument::create(['name' => 'Flute']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => '']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en']);
    });

    it('validates name must be unique across other instruments on update', function () {
        $this->actingAsAdmin();
        Instrument::create(['name' => 'Piano']);
        $instrument = Instrument::create(['name' => 'Violin']);

        $this->putJson("/api/instruments/{$instrument->id}", ['name' => ['en' => 'Piano']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name.en']);
    });

    it('returns 404 for a non-existent instrument', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/instruments/9999', ['name' => ['en' => 'X']])->assertNotFound();
    });
});

// ── DELETE /api/instruments/{instrument} ──────────────────────────────────────

describe('DELETE /api/instruments/{instrument}', function () {
    it('returns 401 without authentication', function () {
        $instrument = Instrument::create(['name' => 'Flute']);

        $this->deleteJson("/api/instruments/{$instrument->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $instrument = Instrument::create(['name' => 'Flute']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/instruments/{$instrument->id}")->assertForbidden();
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
