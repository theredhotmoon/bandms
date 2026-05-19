<?php

use App\Models\BandProfile;
use App\Models\User;
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
            'tech_contact_phone' => '+48 123 456 789',
            'tech_contact_email' => 'tech@band.com',
        ])->assertSuccessful()
          ->assertJsonPath('data.booking_email', 'booking@band.com')
          ->assertJsonPath('data.press_email', 'press@band.com')
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
