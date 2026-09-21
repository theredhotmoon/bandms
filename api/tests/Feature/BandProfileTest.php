<?php

use App\Models\BandProfile;
use App\Models\EpkVersion;
use App\Models\SiteSetting;
use App\Models\TechRider;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
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

    it('defaults about_bio_variant to medium', function () {
        $this->getJson('/api/band-profile')
            ->assertSuccessful()
            ->assertJsonPath('data.about_bio_variant', 'medium');
    });

    it('updates about_bio_variant', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['about_bio_variant' => 'full'])
            ->assertSuccessful()
            ->assertJsonPath('data.about_bio_variant', 'full');

        expect(BandProfile::findOrFail(1)->about_bio_variant)->toBe('full');
    });

    it('rejects an about_bio_variant outside short/medium/long/full', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['about_bio_variant' => 'extra-long'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['about_bio_variant']);
    });

    it('does not allow clearing about_bio_variant to null', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['about_bio_variant' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['about_bio_variant']);
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

    it('asks the public site to rebuild after a save, when auto-rebuild is on', function () {
        Http::fake();
        SiteSetting::set('auto_rebuild', 'true');
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['about_bio_variant' => 'full'])->assertSuccessful();

        Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
    });

    it('does not rebuild when auto-rebuild is off', function () {
        Http::fake();
        SiteSetting::set('auto_rebuild', 'false');
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['about_bio_variant' => 'full'])->assertSuccessful();

        Http::assertNothingSent();
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


describe('epk_tech_rider_id schema', function () {
    beforeEach(fn () => $this->createProfile());

    it('has the FK column and no file columns', function () {
        expect(Schema::hasColumn('band_profiles', 'epk_tech_rider_id'))->toBeTrue()
            ->and(Schema::hasColumn('band_profiles', 'tech_rider_path'))->toBeFalse()
            ->and(Schema::hasColumn('band_profiles', 'stage_plot_path'))->toBeFalse();
    });

    it('resolves the linked rider through epkTechRider()', function () {
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Club show', 'is_active' => false]);
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        expect(BandProfile::findOrFail(1)->epkTechRider->id)->toBe($rider->id);
    });

    it('nulls the link when the rider is deleted', function () {
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Club show', 'is_active' => false]);
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        $rider->delete();

        expect(BandProfile::findOrFail(1)->epk_tech_rider_id)->toBeNull();
    });

    it('no longer exposes the upload endpoints', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/tech-rider')->assertNotFound();
        $this->deleteJson('/api/band-profile/tech-rider')->assertNotFound();
        $this->postJson('/api/band-profile/stage-plot')->assertNotFound();
        $this->deleteJson('/api/band-profile/stage-plot')->assertNotFound();
    });
});
