<?php

use App\Models\BandProfile;
use App\Models\EpkVersion;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

describe('GET /api/band-profile', function () {
    it('returns 404 when no profile exists', function () {
        $this->getJson('/api/band-profile')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $this->createProfile();
        $this->getJson('/api/band-profile')->assertSuccessful();
    });

    it('returns the band name', function () {
        $this->createProfile(['name' => 'Skanking Storks']);

        $this->getJson('/api/band-profile')
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Skanking Storks');
    });

    it('includes empty members and social_links collections', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile')
            ->assertSuccessful()
            ->assertJsonStructure(['data' => ['id', 'name', 'members', 'social_links']]);
    });
});

describe('PUT /api/band-profile', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->putJson('/api/band-profile', ['name' => 'New Name'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson('/api/band-profile', ['name' => 'New Name'])->assertForbidden();
    });

    it('updates the band name', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['name' => 'Skanking Storks'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Skanking Storks');

        expect(BandProfile::findOrFail(1)->name)->toBe('Skanking Storks');
    });

    it('validates name max length is 255', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['name' => str_repeat('a', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('does not allow clearing the name', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('updates all four bio versions', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', [
            'bio_short'  => 'Short (max 280).',
            'bio_medium' => 'Medium press-kit bio.',
            'bio_long'   => 'Long website bio.',
            'bio_full'   => 'Full comprehensive biography.',
        ])->assertSuccessful()
          ->assertJsonPath('data.bio_short', 'Short (max 280).')
          ->assertJsonPath('data.bio_medium', 'Medium press-kit bio.')
          ->assertJsonPath('data.bio_long', 'Long website bio.')
          ->assertJsonPath('data.bio_full', 'Full comprehensive biography.');

        $profile = BandProfile::findOrFail(1);
        expect($profile->bio_short)->toBe('Short (max 280).');
        expect($profile->bio_full)->toBe('Full comprehensive biography.');
    });

    it('validates bio_short max length is 280', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['bio_short' => str_repeat('x', 281)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bio_short']);
    });

    it('allows clearing bios to null', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['bio_short' => null, 'bio_medium' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.bio_short', null);
    });

    it('updates career fields', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', [
            'formation_year'     => 2010,
            'hometown'           => 'Warsaw',
            'genres'             => 'Ska, Reggae, Dub',
            'comparable_artists' => 'Madness, The Specials',
            'artistic_statement' => 'We play ska with love.',
            'career_level'       => 2,
        ])->assertSuccessful()
          ->assertJsonPath('data.formation_year', 2010)
          ->assertJsonPath('data.hometown', 'Warsaw')
          ->assertJsonPath('data.genres', 'Ska, Reggae, Dub')
          ->assertJsonPath('data.comparable_artists', 'Madness, The Specials')
          ->assertJsonPath('data.artistic_statement', 'We play ska with love.')
          ->assertJsonPath('data.career_level', 2);
    });

    it('validates career_level must be between 1 and 4', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['career_level' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['career_level']);

        $this->putJson('/api/band-profile', ['career_level' => 5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['career_level']);
    });

    it('accepts all valid career_level values', function (int $level) {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['career_level' => $level])
            ->assertSuccessful()
            ->assertJsonPath('data.career_level', $level);
    })->with([1, 2, 3, 4]);

    it('updates contact fields', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', [
            'booking_email'      => 'booking@band.com',
            'press_email'        => 'press@band.com',
            'contact_email'      => 'hello@band.com',
            'tech_contact_phone' => '+48 123 456 789',
            'tech_contact_email' => 'tech@band.com',
        ])->assertSuccessful()
          ->assertJsonPath('data.booking_email', 'booking@band.com')
          ->assertJsonPath('data.press_email', 'press@band.com')
          ->assertJsonPath('data.contact_email', 'hello@band.com')
          ->assertJsonPath('data.tech_contact_phone', '+48 123 456 789')
          ->assertJsonPath('data.tech_contact_email', 'tech@band.com');
    });

    it('validates contact email fields must be valid email addresses', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['booking_email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['booking_email']);

        $this->putJson('/api/band-profile', ['press_email' => 'also-invalid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['press_email']);

        $this->putJson('/api/band-profile', ['contact_email' => 'not-valid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['contact_email']);

        $this->putJson('/api/band-profile', ['tech_contact_email' => 'bad'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tech_contact_email']);
    });

    it('is a partial update — unset fields are not cleared', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['hometown' => 'Kraków'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Test Band')
            ->assertJsonPath('data.hometown', 'Kraków');
    });
});

describe('GET /api/band-profile/epk', function () {
    it('returns 404 when no profile exists', function () {
        $this->getJson('/api/band-profile/epk')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/epk')->assertSuccessful();
    });

    it('returns a data key in the response', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/epk')
            ->assertSuccessful()
            ->assertJsonStructure(['data']);
    });

    it('returns the published snapshot when a published EPK version exists', function () {
        $this->createProfile();

        EpkVersion::create([
            'version_number' => 1,
            'release_reason' => 'Initial release',
            'snapshot'       => ['name' => 'Snapshot Band'],
            'status'         => 'published',
            'published_at'   => now(),
        ]);

        $this->getJson('/api/band-profile/epk')
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Snapshot Band');
    });

    it('returns the live profile data when no published EPK version exists', function () {
        $this->createProfile(['name' => 'Live Band']);

        $this->getJson('/api/band-profile/epk')
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Live Band');
    });

    it('returns the latest published snapshot when multiple published versions exist', function () {
        $this->createProfile();

        EpkVersion::create([
            'version_number' => 1,
            'release_reason' => 'First',
            'snapshot'       => ['name' => 'Old Snapshot'],
            'status'         => 'published',
            'published_at'   => now()->subDay(),
        ]);

        EpkVersion::create([
            'version_number' => 2,
            'release_reason' => 'Second',
            'snapshot'       => ['name' => 'Latest Snapshot'],
            'status'         => 'published',
            'published_at'   => now(),
        ]);

        $this->getJson('/api/band-profile/epk')
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Latest Snapshot');
    });
});

describe('POST /api/band-profile/tech-rider', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        Storage::fake('public');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', [
            'file' => UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf'),
        ])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Storage::fake('public');
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', [
            'file' => UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf'),
        ])->assertForbidden();
    });

    it('stores the PDF and updates tech_rider_path on the profile', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])
            ->assertSuccessful();

        $profile = BandProfile::findOrFail(1);
        expect($profile->tech_rider_path)->not->toBeNull();
        Storage::disk('public')->assertExists($profile->tech_rider_path);
    });

    it('returns tech_rider_url in the response after upload', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])
            ->assertSuccessful()
            ->assertJsonPath('data.tech_rider_url', fn ($url) => str_starts_with($url, '/storage/'));
    });

    it('rejects non-PDF files', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.txt', 100, 'text/plain');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('requires a file to be present', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/tech-rider', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('replaces an existing tech rider file', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $first = UploadedFile::fake()->create('rider-v1.pdf', 100, 'application/pdf');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $first])->assertSuccessful();
        $firstPath = BandProfile::findOrFail(1)->tech_rider_path;

        $second = UploadedFile::fake()->create('rider-v2.pdf', 100, 'application/pdf');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $second])->assertSuccessful();
        $secondPath = BandProfile::findOrFail(1)->tech_rider_path;

        expect($secondPath)->not->toBe($firstPath);
        Storage::disk('public')->assertMissing($firstPath);
        Storage::disk('public')->assertExists($secondPath);
    });
});

describe('DELETE /api/band-profile/tech-rider', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->deleteJson('/api/band-profile/tech-rider')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson('/api/band-profile/tech-rider')->assertForbidden();
    });

    it('clears the tech_rider_path field on the profile', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])->assertSuccessful();

        $pathBefore = BandProfile::findOrFail(1)->tech_rider_path;
        expect($pathBefore)->not->toBeNull();

        $this->deleteJson('/api/band-profile/tech-rider')->assertSuccessful();

        $profile = BandProfile::findOrFail(1);
        expect($profile->tech_rider_path)->toBeNull();
    });

    it('deletes the file from storage', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])->assertSuccessful();
        $path = BandProfile::findOrFail(1)->tech_rider_path;

        $this->deleteJson('/api/band-profile/tech-rider')->assertSuccessful();

        Storage::disk('public')->assertMissing($path);
    });

    it('returns null for tech_rider_url after deletion', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('tech-rider.pdf', 100, 'application/pdf');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/tech-rider', ['file' => $file])->assertSuccessful();

        $this->deleteJson('/api/band-profile/tech-rider')
            ->assertSuccessful()
            ->assertJsonPath('data.tech_rider_url', null);
    });

    it('succeeds even when no tech rider is currently set', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/band-profile/tech-rider')->assertSuccessful();

        expect(BandProfile::findOrFail(1)->tech_rider_path)->toBeNull();
    });
});

describe('POST /api/band-profile/stage-plot', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        Storage::fake('public');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', [
            'file' => UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg'),
        ])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Storage::fake('public');
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', [
            'file' => UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg'),
        ])->assertForbidden();
    });

    it('stores the image and updates stage_plot_path on the profile', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])
            ->assertSuccessful();

        $profile = BandProfile::findOrFail(1);
        expect($profile->stage_plot_path)->not->toBeNull();
        Storage::disk('public')->assertExists($profile->stage_plot_path);
    });

    it('returns stage_plot_url in the response after upload', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.png', 100, 'image/png');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])
            ->assertSuccessful()
            ->assertJsonPath('data.stage_plot_url', fn ($url) => str_starts_with($url, '/storage/'));
    });

    it('rejects non-image files', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.pdf', 100, 'application/pdf');

        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('requires a file to be present', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/stage-plot', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    });

    it('replaces an existing stage plot file', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $first = UploadedFile::fake()->create('plot-v1.jpg', 100, 'image/jpeg');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $first])->assertSuccessful();
        $firstPath = BandProfile::findOrFail(1)->stage_plot_path;

        $second = UploadedFile::fake()->create('plot-v2.jpg', 100, 'image/jpeg');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $second])->assertSuccessful();
        $secondPath = BandProfile::findOrFail(1)->stage_plot_path;

        expect($secondPath)->not->toBe($firstPath);
        Storage::disk('public')->assertMissing($firstPath);
        Storage::disk('public')->assertExists($secondPath);
    });
});

describe('DELETE /api/band-profile/stage-plot', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->deleteJson('/api/band-profile/stage-plot')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson('/api/band-profile/stage-plot')->assertForbidden();
    });

    it('clears the stage_plot_path field on the profile', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])->assertSuccessful();

        $pathBefore = BandProfile::findOrFail(1)->stage_plot_path;
        expect($pathBefore)->not->toBeNull();

        $this->deleteJson('/api/band-profile/stage-plot')->assertSuccessful();

        $profile = BandProfile::findOrFail(1);
        expect($profile->stage_plot_path)->toBeNull();
    });

    it('deletes the file from storage', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])->assertSuccessful();
        $path = BandProfile::findOrFail(1)->stage_plot_path;

        $this->deleteJson('/api/band-profile/stage-plot')->assertSuccessful();

        Storage::disk('public')->assertMissing($path);
    });

    it('returns null for stage_plot_url after deletion', function () {
        Storage::fake('public');
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->create('stage-plot.jpg', 100, 'image/jpeg');
        $this->withHeaders(['Accept' => 'application/json'])->post('/api/band-profile/stage-plot', ['file' => $file])->assertSuccessful();

        $this->deleteJson('/api/band-profile/stage-plot')
            ->assertSuccessful()
            ->assertJsonPath('data.stage_plot_url', null);
    });

    it('succeeds even when no stage plot is currently set', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/band-profile/stage-plot')->assertSuccessful();

        expect(BandProfile::findOrFail(1)->stage_plot_path)->toBeNull();
    });
});
