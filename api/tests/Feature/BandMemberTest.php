<?php

use App\Models\BandMember;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/band-profile/members ─────────────────────────────────────────────

describe('GET /api/band-profile/members', function () {
    it('returns 404 when no profile exists', function () {
        $this->getJson('/api/band-profile/members')->assertNotFound();
    });

    it('is publicly accessible without authentication', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/members')->assertSuccessful();
    });

    it('returns empty collection when profile has no members', function () {
        $this->createProfile();

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns current members before former members', function () {
        $this->createProfile();

        BandMember::create(['profile_id' => 1, 'first_name' => 'Former', 'last_name' => 'M', 'is_current' => false, 'sort_order' => 0, 'can_login' => false]);
        BandMember::create(['profile_id' => 1, 'first_name' => 'Active', 'last_name' => 'M', 'is_current' => true,  'sort_order' => 0, 'can_login' => false]);

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.first_name', 'Active');
    });

    it('returns members with social_links and instruments arrays', function () {
        $this->createProfile();
        BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'is_current' => true, 'sort_order' => 0, 'can_login' => false]);

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonStructure(['data' => [['id', 'first_name', 'last_name', 'social_links', 'instruments']]]);
    });
});

// ── POST /api/band-profile/members ────────────────────────────────────────────

describe('POST /api/band-profile/members', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->postJson('/api/band-profile/members', ['first_name' => 'John', 'last_name' => 'Doe'])
            ->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/band-profile/members', ['first_name' => 'John', 'last_name' => 'Doe'])
            ->assertForbidden();
    });

    it('creates a band member with required fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', [
            'first_name' => 'John',
            'last_name'  => 'Doe',
        ])->assertCreated()
          ->assertJsonPath('data.first_name', 'John')
          ->assertJsonPath('data.last_name', 'Doe');

        $this->assertDatabaseHas('band_members', ['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe']);
    });

    it('creates a member with nickname and role', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', [
            'first_name' => 'Jane',
            'nickname'   => 'JJ',
            'last_name'  => 'Smith',
            'role'       => 'Vocals',
        ])->assertCreated()
          ->assertJsonPath('data.nickname', 'JJ')
          ->assertJsonPath('data.role', 'Vocals');
    });

    it('validates that first_name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['last_name' => 'Doe'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name']);
    });

    it('validates that last_name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['first_name' => 'John'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['last_name']);
    });

    it('creates a member with social links', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', [
            'first_name'   => 'John',
            'last_name'    => 'Doe',
            'social_links' => [
                ['platform' => 'instagram', 'url' => 'https://instagram.com/johndoe'],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.social_links.0.platform', 'instagram')
          ->assertJsonPath('data.social_links.0.url', 'https://instagram.com/johndoe');

        $this->assertDatabaseHas('social_links', ['platform' => 'instagram', 'member_id' => 1]);
    });

    it('validates social link platform must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', [
            'first_name'   => 'John',
            'last_name'    => 'Doe',
            'social_links' => [['platform' => 'unknown_platform', 'url' => 'https://example.com']],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['social_links.0.platform']);
    });

    it('validates quit_at must be after or equal to joined_at', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', [
            'first_name' => 'John',
            'last_name'  => 'Doe',
            'joined_at'  => '2020-01-01',
            'quit_at'    => '2019-01-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['quit_at']);
    });
});

// ── PUT /api/band-profile/members/{member} ────────────────────────────────────

describe('PUT /api/band-profile/members/{member}', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['first_name' => 'Jane'])
            ->assertUnauthorized();
    });

    it('allows admin to update any member', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", [
            'first_name' => 'Jane',
            'last_name'  => 'Smith',
            'role'       => 'Guitar',
        ])->assertSuccessful()
          ->assertJsonPath('data.first_name', 'Jane')
          ->assertJsonPath('data.role', 'Guitar');

        $this->assertDatabaseHas('band_members', ['id' => $member->id, 'first_name' => 'Jane']);
    });

    it('allows a member to update their own record', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        $this->actingAsMember($member->id);

        $this->putJson("/api/band-profile/members/{$member->id}", ['bio' => 'Updated bio.'])
            ->assertSuccessful()
            ->assertJsonPath('data.bio', 'Updated bio.');
    });

    it('forbids a member from updating another member', function () {
        $memberA = BandMember::create(['profile_id' => 1, 'first_name' => 'Alice', 'last_name' => 'A', 'can_login' => false]);
        $memberB = BandMember::create(['profile_id' => 1, 'first_name' => 'Bob',   'last_name' => 'B', 'can_login' => false]);
        $this->actingAsMember($memberA->id);

        $this->putJson("/api/band-profile/members/{$memberB->id}", ['first_name' => 'Hacked'])
            ->assertForbidden();
    });

    it('replaces social links on update', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", [
            'social_links' => [['platform' => 'spotify', 'url' => 'https://open.spotify.com/artist/test']],
        ])->assertSuccessful();

        // Second update replaces the first set of links
        $this->putJson("/api/band-profile/members/{$member->id}", [
            'social_links' => [['platform' => 'instagram', 'url' => 'https://instagram.com/test']],
        ])->assertSuccessful();

        $this->assertDatabaseCount('social_links', 1);
        $this->assertDatabaseHas('social_links', ['platform' => 'instagram', 'member_id' => $member->id]);
    });

    it('returns 404 for a non-existent member', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/members/9999', ['first_name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/band-profile/members/{member} ─────────────────────────────────

describe('DELETE /api/band-profile/members/{member}', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->deleteJson("/api/band-profile/members/{$member->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/band-profile/members/{$member->id}")->assertForbidden();
    });

    it('deletes a member', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->deleteJson("/api/band-profile/members/{$member->id}")->assertNoContent();

        $this->assertDatabaseMissing('band_members', ['id' => $member->id]);
    });

    it('returns 404 for a non-existent member', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/band-profile/members/9999')->assertNotFound();
    });
});

// ── PUT /api/band-profile/members/reorder ────────────────────────────────────

describe('PUT /api/band-profile/members/reorder', function () {
    beforeEach(fn () => $this->createProfile());

    it('returns 401 without authentication', function () {
        $this->putJson('/api/band-profile/members/reorder', ['ids' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson('/api/band-profile/members/reorder', ['ids' => []])->assertForbidden();
    });

    it('reorders members by updating sort_order', function () {
        $this->actingAsAdmin();
        $memberA = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'A', 'sort_order' => 0, 'can_login' => false]);
        $memberB = BandMember::create(['profile_id' => 1, 'first_name' => 'B', 'last_name' => 'B', 'sort_order' => 1, 'can_login' => false]);

        $this->putJson('/api/band-profile/members/reorder', [
            'ids' => [$memberB->id, $memberA->id],
        ])->assertSuccessful()
          ->assertJsonPath('ok', true);

        expect(BandMember::find($memberB->id)->sort_order)->toBe(0);
        expect(BandMember::find($memberA->id)->sort_order)->toBe(1);
    });

    it('validates ids is required', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile/members/reorder', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
    });
});
