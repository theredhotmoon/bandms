<?php

use App\Models\BandMember;
use App\Models\SocialLink;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/band-profile/social-links ────────────────────────────────────────

describe('GET /api/band-profile/social-links', function () {
    it('returns 404 when no profile exists', function () {
        $this->getJson('/api/band-profile/social-links')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/social-links')->assertSuccessful();
    });

    it('returns empty collection when no links exist', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/social-links')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns band-level links in saved position order', function () {
        $this->createProfile();
        SocialLink::create(['profile_id' => 1, 'platform' => 'youtube',   'url' => 'https://youtube.com/test',   'position' => 0]);
        SocialLink::create(['profile_id' => 1, 'platform' => 'instagram', 'url' => 'https://instagram.com/test', 'position' => 1]);

        $this->getJson('/api/band-profile/social-links')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.platform', 'youtube')
            ->assertJsonPath('data.1.platform', 'instagram');
    });

    it('excludes member-scoped social links', function () {
        $this->createProfile();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        SocialLink::create(['profile_id' => 1,             'platform' => 'spotify',   'url' => 'https://spotify.com/band']);
        SocialLink::create(['profile_id' => 1, 'member_id' => $member->id, 'platform' => 'instagram', 'url' => 'https://instagram.com/john']);

        $this->getJson('/api/band-profile/social-links')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.platform', 'spotify');
    });
});

// ── POST /api/band-profile/social-links ───────────────────────────────────────

describe('POST /api/band-profile/social-links', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/artist/test',
        ])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/artist/test',
        ])->assertForbidden();
    });

    it('creates a social link', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/artist/test',
        ])->assertCreated()
          ->assertJsonPath('data.platform', 'spotify')
          ->assertJsonPath('data.url', 'https://open.spotify.com/artist/test');

        $this->assertDatabaseHas('social_links', ['profile_id' => 1, 'platform' => 'spotify']);
    });

    it('validates platform is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'url' => 'https://open.spotify.com/artist/test',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['platform']);
    });

    it('validates platform must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'myspace',
            'url'      => 'https://myspace.com/test',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['platform']);
    });

    it('accepts all known platforms', function (string $platform) {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => $platform,
            'url'      => 'https://example.com/test',
        ])->assertCreated();
    })->with(['spotify', 'instagram', 'facebook', 'youtube', 'tiktok', 'bandcamp', 'soundcloud', 'twitter', 'website']);

    it('validates url format', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'not-a-url',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['url']);
    });

    it('validates url is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', ['platform' => 'spotify'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });
});

// ── PUT /api/band-profile/social-links/{link} ─────────────────────────────────

describe('PUT /api/band-profile/social-links/{link}', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'instagram',
            'url'      => 'https://instagram.com/test',
        ])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'spotify',
            'url'      => 'https://spotify.com/test',
        ])->assertForbidden();
    });

    it('updates a social link', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://open.spotify.com/old']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/new',
        ])->assertSuccessful()
          ->assertJsonPath('data.platform', 'spotify')
          ->assertJsonPath('data.url', 'https://open.spotify.com/new');

        $this->assertDatabaseHas('social_links', ['id' => $link->id, 'url' => 'https://open.spotify.com/new']);
    });

    it('can change the platform on update', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'instagram',
            'url'      => 'https://instagram.com/test',
        ])->assertSuccessful()
          ->assertJsonPath('data.platform', 'instagram');
    });

    it('validates platform on update', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'invalid_platform',
            'url'      => 'https://example.com',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['platform']);
    });

    it('returns 404 for a non-existent link', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/social-links/9999', [
            'platform' => 'spotify',
            'url'      => 'https://spotify.com/test',
        ])->assertNotFound();
    });
});

// ── PUT /api/band-profile/social-links (sync) ─────────────────────────────────

describe('PUT /api/band-profile/social-links (sync)', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->putJson('/api/band-profile/social-links', ['links' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson('/api/band-profile/social-links', ['links' => []])->assertForbidden();
    });

    it('replaces all links and preserves request order', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/social-links', [
            'links' => [
                ['platform' => 'youtube',   'url' => 'https://youtube.com/test'],
                ['platform' => 'instagram', 'url' => 'https://instagram.com/test'],
                ['platform' => 'spotify',   'url' => 'https://spotify.com/test'],
            ],
        ])->assertSuccessful()
          ->assertJsonCount(3, 'data')
          ->assertJsonPath('data.0.platform', 'youtube')
          ->assertJsonPath('data.1.platform', 'instagram')
          ->assertJsonPath('data.2.platform', 'spotify');
    });

    it('stores position values matching the request index', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/social-links', [
            'links' => [
                ['platform' => 'tiktok',   'url' => 'https://tiktok.com/test'],
                ['platform' => 'facebook', 'url' => 'https://facebook.com/test'],
            ],
        ])->assertSuccessful();

        $this->assertDatabaseHas('social_links', ['platform' => 'tiktok',   'position' => 0]);
        $this->assertDatabaseHas('social_links', ['platform' => 'facebook', 'position' => 1]);
    });

    it('clears all links when links is empty', function () {
        $this->actingAsAdmin();
        SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test', 'position' => 0]);

        $this->putJson('/api/band-profile/social-links', ['links' => []])
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');

        $this->assertDatabaseCount('social_links', 0);
    });
});

// ── DELETE /api/band-profile/social-links/{link} ──────────────────────────────

describe('DELETE /api/band-profile/social-links/{link}', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);

        $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertForbidden();
    });

    it('deletes a social link', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://spotify.com/test']);

        $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertNoContent();

        $this->assertDatabaseMissing('social_links', ['id' => $link->id]);
    });

    it('returns 404 for a non-existent link', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/band-profile/social-links/9999')->assertNotFound();
    });
});
