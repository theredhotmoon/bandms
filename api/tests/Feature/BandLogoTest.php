<?php

use App\Models\BandLogo;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(function () {
    $this->createProfile();
    Storage::fake('public');
});

// ── GET /api/band-profile/logos ───────────────────────────────────────────────

describe('GET /api/band-profile/logos', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/band-profile/logos')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/band-profile/logos')->assertForbidden();
    });

    it('returns all logos including deprecated ones', function () {
        $this->actingAsAdmin();
        BandLogo::factory()->default()->create();
        BandLogo::factory()->deprecated()->create();

        $this->getJson('/api/band-profile/logos')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });

    it('returns logos ordered by sort_order asc', function () {
        $this->actingAsAdmin();
        BandLogo::factory()->create(['label' => 'Second', 'sort_order' => 2]);
        BandLogo::factory()->create(['label' => 'First',  'sort_order' => 1]);

        $this->getJson('/api/band-profile/logos')
            ->assertSuccessful()
            ->assertJsonPath('data.0.label', 'First');
    });

    it('returns empty array when no logos exist', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/band-profile/logos')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('includes expected resource fields', function () {
        $this->actingAsAdmin();
        BandLogo::factory()->default()->create(['label' => 'Main Logo', 'variant' => 'full', 'background' => 'dark']);

        $data = $this->getJson('/api/band-profile/logos')->assertSuccessful()->json('data');

        expect($data[0])->toHaveKeys(['id', 'url', 'label', 'variant', 'background', 'is_default', 'is_deprecated', 'version_label', 'notes']);
        expect($data[0]['label'])->toBe('Main Logo');
        expect($data[0]['is_default'])->toBeTrue();
    });
});

// ── POST /api/band-profile/logos ──────────────────────────────────────────────

describe('POST /api/band-profile/logos', function () {
    it('returns 401 without authentication', function () {
        $file = UploadedFile::fake()->create('logo.png', 100, 'image/png');

        $this->postJson('/api/band-profile/logos', ['file' => $file])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $file = UploadedFile::fake()->create('logo.png', 100, 'image/png');
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/band-profile/logos', ['file' => $file])->assertForbidden();
    });

    it('uploads a logo and stores the file', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('band-logo.png', 100, 'image/png');

        $this->postJson('/api/band-profile/logos', [
            'file'    => $file,
            'label'   => 'Primary',
            'variant' => 'full',
        ])->assertCreated()
          ->assertJsonPath('data.label', 'Primary')
          ->assertJsonPath('data.variant', 'full');

        $logo = BandLogo::first();
        Storage::disk('public')->assertExists($logo->file_path);
    });

    it('first logo auto-becomes default', function () {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/band-profile/logos', [
            'file' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ])->assertCreated();

        expect($response->json('data.is_default'))->toBeTrue();
    });

    it('subsequent logos are not default automatically', function () {
        $this->actingAsAdmin();
        BandLogo::factory()->default()->create();

        $response = $this->postJson('/api/band-profile/logos', [
            'file' => UploadedFile::fake()->create('logo2.png', 100, 'image/png'),
        ])->assertCreated();

        expect($response->json('data.is_default'))->toBeFalse();
    });

    it('validates file is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/logos', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('validates file must be an image', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');

        $this->postJson('/api/band-profile/logos', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('validates variant must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/logos', [
            'file'    => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
            'variant' => 'unknown',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['variant']);
    });

    it('validates background must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/logos', [
            'file'       => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
            'background' => 'neon',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['background']);
    });

    it('accepts SVG files', function () {
        $this->actingAsAdmin();
        $file = UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml');

        $this->postJson('/api/band-profile/logos', ['file' => $file])
            ->assertCreated();
    });
});

// ── PUT /api/band-profile/logos/{logo} ───────────────────────────────────────

describe('PUT /api/band-profile/logos/{logo}', function () {
    it('returns 401 without authentication', function () {
        $logo = BandLogo::factory()->create();

        $this->putJson("/api/band-profile/logos/{$logo->id}", ['label' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $logo = BandLogo::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/band-profile/logos/{$logo->id}", ['label' => 'X'])->assertForbidden();
    });

    it('updates metadata', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->create(['label' => 'Old']);

        $this->putJson("/api/band-profile/logos/{$logo->id}", [
            'label'   => 'New',
            'variant' => 'icon',
            'notes'   => 'Use on dark backgrounds',
        ])->assertSuccessful()
          ->assertJsonPath('data.label', 'New')
          ->assertJsonPath('data.variant', 'icon')
          ->assertJsonPath('data.notes', 'Use on dark backgrounds');
    });

    it('can deprecate a non-default logo', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->create(['is_default' => false]);

        $this->putJson("/api/band-profile/logos/{$logo->id}", ['is_deprecated' => true])
            ->assertSuccessful()
            ->assertJsonPath('data.is_deprecated', true);
    });

    it('cannot deprecate the current default logo', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->default()->create();

        $this->putJson("/api/band-profile/logos/{$logo->id}", ['is_deprecated' => true])
            ->assertStatus(422);
    });

    it('returns 404 for a non-existent logo', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/logos/9999', ['label' => 'X'])->assertNotFound();
    });
});

// ── POST /api/band-profile/logos/{logo}/set-default ──────────────────────────

describe('POST /api/band-profile/logos/{logo}/set-default', function () {
    it('returns 401 without authentication', function () {
        $logo = BandLogo::factory()->create();

        $this->postJson("/api/band-profile/logos/{$logo->id}/set-default")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $logo = BandLogo::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson("/api/band-profile/logos/{$logo->id}/set-default")->assertForbidden();
    });

    it('sets the logo as default and unsets all others', function () {
        $this->actingAsAdmin();
        $logoA = BandLogo::factory()->default()->create();
        $logoB = BandLogo::factory()->create(['is_default' => false]);

        $this->postJson("/api/band-profile/logos/{$logoB->id}/set-default")
            ->assertSuccessful()
            ->assertJsonPath('data.is_default', true);

        $this->assertDatabaseHas('band_logos', ['id' => $logoA->id, 'is_default' => 0]);
        $this->assertDatabaseHas('band_logos', ['id' => $logoB->id, 'is_default' => 1]);
    });

    it('cannot set a deprecated logo as default', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->deprecated()->create();

        $this->postJson("/api/band-profile/logos/{$logo->id}/set-default")
            ->assertStatus(422);
    });

    it('returns 404 for a non-existent logo', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/logos/9999/set-default')->assertNotFound();
    });
});

// ── DELETE /api/band-profile/logos/{logo} ────────────────────────────────────

describe('DELETE /api/band-profile/logos/{logo}', function () {
    it('returns 401 without authentication', function () {
        $logo = BandLogo::factory()->create();

        $this->deleteJson("/api/band-profile/logos/{$logo->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $logo = BandLogo::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/band-profile/logos/{$logo->id}")->assertForbidden();
    });

    it('deletes a non-default logo', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->create(['is_default' => false]);

        $this->deleteJson("/api/band-profile/logos/{$logo->id}")->assertNoContent();

        $this->assertDatabaseMissing('band_logos', ['id' => $logo->id]);
    });

    it('deletes the default logo when it is the only one', function () {
        $this->actingAsAdmin();
        $logo = BandLogo::factory()->default()->create();

        $this->deleteJson("/api/band-profile/logos/{$logo->id}")->assertNoContent();

        $this->assertDatabaseMissing('band_logos', ['id' => $logo->id]);
    });

    it('cannot delete the default logo when another non-deprecated logo exists', function () {
        $this->actingAsAdmin();
        $default = BandLogo::factory()->default()->create();
        BandLogo::factory()->create(['is_default' => false, 'is_deprecated' => false]);

        $this->deleteJson("/api/band-profile/logos/{$default->id}")
            ->assertStatus(422);
    });

    it('can delete the default logo when the only other logos are deprecated', function () {
        $this->actingAsAdmin();
        $default = BandLogo::factory()->default()->create();
        BandLogo::factory()->deprecated()->create();

        $this->deleteJson("/api/band-profile/logos/{$default->id}")->assertNoContent();

        $this->assertDatabaseMissing('band_logos', ['id' => $default->id]);
    });

    it('deletes the stored file from disk', function () {
        $this->actingAsAdmin();
        Storage::disk('public')->put('logos/test.png', 'fake');
        $logo = BandLogo::factory()->create(['file_path' => 'logos/test.png', 'is_default' => false]);

        $this->deleteJson("/api/band-profile/logos/{$logo->id}")->assertNoContent();

        Storage::disk('public')->assertMissing('logos/test.png');
    });

    it('returns 404 for a non-existent logo', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/band-profile/logos/9999')->assertNotFound();
    });
});
