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

    it('hides login_email from an unauthenticated request', function () {
        $this->createProfile();
        BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'is_current' => true, 'sort_order' => 0, 'can_login' => true, 'login_email' => 'john@example.com']);

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonMissingPath('data.0.login_email');
    });

    // Regression: this route deliberately carries no auth:api middleware (the
    // public site builds from it too), so nothing switches the app's default
    // guard to 'api'. A real Bearer token sent by the admin panel must still
    // be honoured here. Passport::actingAs() can't exercise this — it sets
    // the default guard directly — so this issues a real token over a real
    // HTTP header instead, the same way the admin SPA actually calls this.
    it('exposes login_email to an admin sending a real Bearer token, even on this unmiddlewared route', function () {
        $this->createProfile();
        BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'is_current' => true, 'sort_order' => 0, 'can_login' => true, 'login_email' => 'john@example.com']);

        \Laravel\Passport\Client::factory()->asPersonalAccessTokenClient()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->accessToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonPath('data.0.login_email', 'john@example.com');
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
            'role'       => 'Vocals', // a member needs an instrument or a role
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
            'role'         => 'Vocals',
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

    it('prevents a member from altering admin-only fields on their own profile', function () {
        $member = BandMember::create([
            'profile_id'  => 1,
            'first_name'  => 'John',
            'last_name'   => 'Doe',
            'is_current'  => false,
            'can_login'   => false,
            'login_email' => 'original@example.com',
            'sort_order'  => 5,
            'joined_at'   => '2020-01-01',
            'quit_at'     => '2021-01-01',
            'photo'       => '/storage/members/original.jpg',
        ]);
        $this->actingAsMember($member->id);

        $this->putJson("/api/band-profile/members/{$member->id}", [
            'bio'         => 'Member updated bio',
            'can_login'   => true,
            'login_email' => 'escalated@example.com',
            'is_current'  => true,
            'sort_order'  => 0,
            'joined_at'   => '2022-02-02',
            'quit_at'     => '2023-03-03',
            'photo'       => null,
        ])->assertSuccessful();

        $member->refresh();
        expect($member->bio)->toBe('Member updated bio')
            ->and((bool) $member->can_login)->toBeFalse()
            ->and($member->login_email)->toBe('original@example.com')
            ->and((bool) $member->is_current)->toBeFalse()
            ->and($member->sort_order)->toBe(5)
            ->and($member->joined_at->toDateString())->toBe('2020-01-01')
            ->and($member->quit_at->toDateString())->toBe('2021-01-01')
            ->and($member->photo)->toBe('/storage/members/original.jpg');
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

// ── Every member plays something or has a role ───────────────────────────────

describe('a member has an instrument or a role', function () {
    beforeEach(function () {
        $this->createProfile();
        $this->actingAsAdmin();
        $this->trumpet = \App\Models\Instrument::create(['name' => 'Trumpet', 'category' => 'Brass']);
    });

    it('refuses a new member with neither', function () {
        $this->postJson('/api/band-profile/members', ['first_name' => 'No', 'last_name' => 'Part'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);

        $this->assertDatabaseMissing('band_members', ['first_name' => 'No']);
    });

    it('refuses a role that is only whitespace', function () {
        $this->postJson('/api/band-profile/members', ['first_name' => 'No', 'last_name' => 'Part', 'role' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);
    });

    it('accepts a new member with only an instrument', function () {
        $this->postJson('/api/band-profile/members', [
            'first_name' => 'Has', 'last_name' => 'Trumpet', 'instrument_ids' => [$this->trumpet->id],
        ])->assertCreated();
    });

    it('accepts a new member with only a role', function () {
        $this->postJson('/api/band-profile/members', ['first_name' => 'Has', 'last_name' => 'Role', 'role' => 'Sound engineer'])
            ->assertCreated();
    });

    it('refuses an update that clears both', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['role' => null, 'instrument_ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);

        expect($member->fresh()->role)->toBe('Manager');
    });

    it('lets an update that touches neither field through, even for a member with no part', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['bio' => 'New bio'])
            ->assertSuccessful();
    });

    it('refuses clearing the role of a member who has no instrument', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager', 'can_login' => false]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['role' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);
    });

    it('judges a field the update did not send by its stored value', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'can_login' => false]);
        $member->instruments()->sync([$this->trumpet->id]);

        // Clearing the role is fine: the stored instrument still counts.
        $this->putJson("/api/band-profile/members/{$member->id}", ['role' => null])
            ->assertSuccessful();
    });

    // `update()` used to sync `instrument_ids ?? []`, so any PUT that left the
    // key out — a partial update — silently removed every instrument.
    it('keeps the instruments when an update does not send them', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'can_login' => false]);
        $member->instruments()->sync([$this->trumpet->id]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['bio' => 'New bio'])
            ->assertSuccessful();

        expect($member->fresh()->instruments->pluck('id')->all())->toBe([$this->trumpet->id]);
    });

    // Same wipe, for links: `socialLinks()->delete()` ran on every update.
    it('keeps the social links when an update does not send them', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager', 'can_login' => false]);
        $member->socialLinks()->create(['profile_id' => 1, 'platform' => 'instagram', 'url' => 'https://instagram.com/a', 'position' => 0]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['public_page' => false])
            ->assertSuccessful();

        expect($member->fresh()->socialLinks->pluck('url')->all())->toBe(['https://instagram.com/a']);
    });

    it('still clears the social links when an update sends an empty list', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager', 'can_login' => false]);
        $member->socialLinks()->create(['profile_id' => 1, 'platform' => 'instagram', 'url' => 'https://instagram.com/a', 'position' => 0]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['social_links' => []])
            ->assertSuccessful();

        expect($member->fresh()->socialLinks)->toHaveCount(0);
    });

    // My Profile: the rule reads the request, the write reads the validated
    // data, and a member's data has fields stripped — the two must agree.
    it('refuses a musician clearing both on their own profile', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager', 'can_login' => false]);
        $this->actingAsMember($member->id);

        $this->putJson("/api/band-profile/members/{$member->id}", ['role' => null, 'instrument_ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);

        expect($member->fresh()->role)->toBe('Manager');
    });

    // The main instrument is a column beside the pivot; on its own it counts.
    it('accepts a new member with only a main instrument', function () {
        $this->postJson('/api/band-profile/members', [
            'first_name' => 'Has', 'last_name' => 'Main', 'main_instrument_id' => $this->trumpet->id,
        ])->assertCreated();
    });

    it('counts a stored main instrument when the pivot is empty', function () {
        $member = BandMember::create([
            'profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B', 'role' => 'Manager',
            'main_instrument_id' => $this->trumpet->id, 'can_login' => false,
        ]);

        $this->putJson("/api/band-profile/members/{$member->id}", ['role' => null, 'instrument_ids' => []])
            ->assertSuccessful();
    });

    it('refuses an update that clears the main instrument too', function () {
        $member = BandMember::create([
            'profile_id' => 1, 'first_name' => 'A', 'last_name' => 'B',
            'main_instrument_id' => $this->trumpet->id, 'can_login' => false,
        ]);

        // Sending only the main instrument is judged: it can remove the last part.
        $this->putJson("/api/band-profile/members/{$member->id}", ['main_instrument_id' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['instrument_ids']);

        expect($member->fresh()->main_instrument_id)->toBe($this->trumpet->id);
    });
});
