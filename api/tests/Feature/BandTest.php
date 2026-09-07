<?php

use App\Models\Author;
use App\Models\Band;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/bands ────────────────────────────────────────────────────────────

describe('GET /api/bands', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/bands')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/bands')->assertForbidden();
    });

    it('returns all bands ordered by name', function () {
        $this->actingAsAdmin();
        Band::create(['name' => 'Zebra Band']);
        Band::create(['name' => 'Alpha Wolves']);

        $this->getJson('/api/bands')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Wolves');
    });

    it('returns empty collection when no bands exist', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/bands')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

// ── GET /api/bands/{band} ─────────────────────────────────────────────────────

describe('GET /api/bands/{band}', function () {
    it('returns the band', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Steel Panda']);

        $this->getJson("/api/bands/{$band->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Steel Panda');
    });

    it('returns 404 for a non-existent band', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/bands/9999')->assertNotFound();
    });
});

// ── POST /api/bands ───────────────────────────────────────────────────────────

describe('POST /api/bands', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/bands', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/bands', ['name' => 'Test'])->assertForbidden();
    });

    it('creates a band', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', ['name' => 'Iron Fist'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Iron Fist');

        $this->assertDatabaseHas('bands', ['name' => 'Iron Fist']);
    });

    it('creates a band with a website', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', ['name' => 'Web Band', 'website' => 'https://example.com'])
            ->assertCreated()
            ->assertJsonPath('data.website', 'https://example.com');
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name max length is 255', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', ['name' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name must be unique', function () {
        $this->actingAsAdmin();
        Band::create(['name' => 'Taken Name']);

        $this->postJson('/api/bands', ['name' => 'Taken Name'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates website must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', ['name' => 'Band', 'website' => 'not-a-url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['website']);
    });
});

// ── PUT /api/bands/{band} ─────────────────────────────────────────────────────

describe('PUT /api/bands/{band}', function () {
    it('returns 401 without authentication', function () {
        $band = Band::create(['name' => 'Old Name']);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'New'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $band = Band::create(['name' => 'Old Name']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/bands/{$band->id}", ['name' => 'New'])->assertForbidden();
    });

    it('updates a band name', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Old Name']);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('bands', ['id' => $band->id, 'name' => 'New Name']);
    });

    it('validates name must not be empty on update', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Some Band']);

        $this->putJson("/api/bands/{$band->id}", ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('allows keeping the same name on update', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Same Name']);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'Same Name'])
            ->assertSuccessful();
    });

    it('returns 404 for a non-existent band', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/bands/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/bands/{band} ──────────────────────────────────────────────────

describe('DELETE /api/bands/{band}', function () {
    it('returns 401 without authentication', function () {
        $band = Band::create(['name' => 'Band']);

        $this->deleteJson("/api/bands/{$band->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $band = Band::create(['name' => 'Band']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/bands/{$band->id}")->assertForbidden();
    });

    it('deletes a band', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Gone Band']);

        $this->deleteJson("/api/bands/{$band->id}")->assertNoContent();

        $this->assertDatabaseMissing('bands', ['id' => $band->id]);
    });

    it('returns 404 for a non-existent band', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/bands/9999')->assertNotFound();
    });
});

// ── Contact people (authors) ──────────────────────────────────────────────────

describe('band contact people', function () {
    it('creates a band with contact people attached', function () {
        $this->actingAsAdmin();
        $manager = Author::create(['name' => 'Mia Manager', 'email' => 'mia@mgmt.com']);
        $booker  = Author::create(['name' => 'Bob Booker', 'phone' => '+48 111 222 333']);

        $this->postJson('/api/bands', [
            'name'       => 'Contactable Band',
            'author_ids' => [$manager->id, $booker->id],
        ])->assertCreated()
          ->assertJsonCount(2, 'data.contacts');

        $this->assertDatabaseHas('author_bands', ['author_id' => $manager->id]);
        $this->assertDatabaseHas('author_bands', ['author_id' => $booker->id]);
    });

    it('exposes contact details on the band listing', function () {
        $this->actingAsAdmin();
        $author = Author::create([
            'name'     => 'Cara Contact',
            'email'    => 'cara@example.com',
            'phone'    => '+48 500 600 700',
            'whatsapp' => '+48 500 600 700',
        ]);
        $band = Band::create(['name' => 'Listed Band']);
        $band->authors()->attach($author);

        $this->getJson('/api/bands')
            ->assertSuccessful()
            ->assertJsonPath('data.0.contacts.0.name', 'Cara Contact')
            ->assertJsonPath('data.0.contacts.0.email', 'cara@example.com')
            ->assertJsonPath('data.0.contacts.0.phone', '+48 500 600 700')
            ->assertJsonPath('data.0.contacts.0.whatsapp', '+48 500 600 700');
    });

    it('replaces contact people on update', function () {
        $this->actingAsAdmin();
        $old = Author::create(['name' => 'Old Contact']);
        $new = Author::create(['name' => 'New Contact']);
        $band = Band::create(['name' => 'Switching Band']);
        $band->authors()->attach($old);

        $this->putJson("/api/bands/{$band->id}", [
            'name'       => 'Switching Band',
            'author_ids' => [$new->id],
        ])->assertSuccessful()
          ->assertJsonCount(1, 'data.contacts')
          ->assertJsonPath('data.contacts.0.name', 'New Contact');

        $this->assertDatabaseMissing('author_bands', ['author_id' => $old->id, 'band_id' => $band->id]);
        $this->assertDatabaseHas('author_bands', ['author_id' => $new->id, 'band_id' => $band->id]);
    });

    it('clears contact people when an empty array is sent', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Doomed Contact']);
        $band = Band::create(['name' => 'Clearing Band']);
        $band->authors()->attach($author);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'Clearing Band', 'author_ids' => []])
            ->assertSuccessful()
            ->assertJsonCount(0, 'data.contacts');

        $this->assertDatabaseMissing('author_bands', ['band_id' => $band->id]);
    });

    it('keeps contact people when author_ids is omitted entirely', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Sticky Contact']);
        $band = Band::create(['name' => 'Renamed Band']);
        $band->authors()->attach($author);

        $this->putJson("/api/bands/{$band->id}", ['name' => 'Renamed Band 2'])
            ->assertSuccessful()
            ->assertJsonCount(1, 'data.contacts');

        $this->assertDatabaseHas('author_bands', ['author_id' => $author->id, 'band_id' => $band->id]);
    });

    it('validates that every author id exists', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/bands', ['name' => 'Bad Contacts', 'author_ids' => [9999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['author_ids.0']);
    });

    it('detaches the pivot row when a contact is deleted', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Temporary Contact']);
        $band = Band::create(['name' => 'Orphaned Band']);
        $band->authors()->attach($author);

        $author->delete();

        $this->assertDatabaseMissing('author_bands', ['band_id' => $band->id]);
    });

    it('does not attach the same contact twice', function () {
        $this->actingAsAdmin();
        $author = Author::create(['name' => 'Once Only']);

        $this->postJson('/api/bands', [
            'name'       => 'Dedupe Band',
            'author_ids' => [$author->id, $author->id],
        ])->assertCreated()
          ->assertJsonCount(1, 'data.contacts');
    });
});
