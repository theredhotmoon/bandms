<?php

use Illuminate\Support\Facades\Http;

beforeEach(fn () => $this->createProfile());

// ── POST /api/band-profile/sync-facebook-likes ────────────────────────────────

describe('POST /api/band-profile/sync-facebook-likes', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/band-profile/sync-facebook-likes')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->postJson('/api/band-profile/sync-facebook-likes')->assertForbidden();
    });

    it('returns 503 when Facebook credentials are not configured', function () {
        config([
            'services.facebook.app_id'     => '',
            'services.facebook.app_secret' => '',
            'services.facebook.page_id'    => '',
        ]);
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/sync-facebook-likes')
            ->assertStatus(503)
            ->assertJsonPath('message', 'Facebook credentials not configured. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and FACEBOOK_PAGE_ID in .env.');
    });

    it('returns 503 when only some Facebook credentials are missing', function () {
        config(['services.facebook.app_id' => 'some-id', 'services.facebook.app_secret' => '', 'services.facebook.page_id' => '123']);
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/sync-facebook-likes')->assertStatus(503);
    });

    it('syncs fan_count and updates the band profile', function () {
        config([
            'services.facebook.app_id'     => 'test-app-id',
            'services.facebook.app_secret' => 'test-app-secret',
            'services.facebook.page_id'    => '123456789',
        ]);
        $this->actingAsAdmin();

        Http::fake([
            'graph.facebook.com/*' => Http::response(['fan_count' => 42000], 200),
        ]);

        $this->postJson('/api/band-profile/sync-facebook-likes')
            ->assertSuccessful()
            ->assertJsonPath('message', 'Facebook likes synced successfully.')
            ->assertJsonPath('likes', 42000);

        $this->assertDatabaseHas('band_profiles', ['id' => 1, 'facebook_likes' => 42000]);
    });

    it('returns 502 when the Facebook Graph API request fails', function () {
        config([
            'services.facebook.app_id'     => 'test-app-id',
            'services.facebook.app_secret' => 'test-secret',
            'services.facebook.page_id'    => '123',
        ]);
        $this->actingAsAdmin();

        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Invalid token']], 400)]);

        $this->postJson('/api/band-profile/sync-facebook-likes')->assertStatus(502);
    });

    it('returns 422 when fan_count is missing from the API response', function () {
        config([
            'services.facebook.app_id'     => 'app',
            'services.facebook.app_secret' => 'secret',
            'services.facebook.page_id'    => 'page',
        ]);
        $this->actingAsAdmin();

        Http::fake(['graph.facebook.com/*' => Http::response(['id' => 'page', 'name' => 'My Band'], 200)]);

        $this->postJson('/api/band-profile/sync-facebook-likes')
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Facebook did not return fan_count. The page may not be public or the credentials may lack access.']);
    });
});
