<?php

use App\Models\BandMember;
use App\Models\BandMemberSetup;
use App\Models\User;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/band-profile/members/{member}/setups ─────────────────────────────

describe('GET /api/band-profile/members/{member}/setups', function () {
    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->getJson("/api/band-profile/members/{$member->id}/setups")->assertUnauthorized();
    });

    it('allows admin to list setups for any member', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Guitar Rig', 'signal_chain_type' => 'amp_mic']);

        $this->getJson("/api/band-profile/members/{$member->id}/setups")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('allows a member to list their own setups', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        $this->actingAsMember($member->id);

        $this->getJson("/api/band-profile/members/{$member->id}/setups")
            ->assertSuccessful();
    });

    it('forbids a member from listing another member\'s setups', function () {
        $memberA = BandMember::create(['profile_id' => 1, 'first_name' => 'Alice', 'last_name' => 'A', 'can_login' => false]);
        $memberB = BandMember::create(['profile_id' => 1, 'first_name' => 'Bob',   'last_name' => 'B', 'can_login' => false]);
        $this->actingAsMember($memberA->id);

        $this->getJson("/api/band-profile/members/{$memberB->id}/setups")->assertForbidden();
    });
});

// ── POST /api/band-profile/members/{member}/setups ────────────────────────────

describe('POST /api/band-profile/members/{member}/setups', function () {
    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", [
            'name'               => 'Rig',
            'signal_chain_type'  => 'amp_mic',
        ])->assertUnauthorized();
    });

    it('creates a setup for a member', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", [
            'name'               => 'Electric Guitar Rig',
            'signal_chain_type'  => 'amp_mic',
        ])->assertCreated()
          ->assertJsonPath('data.name', 'Electric Guitar Rig');

        $this->assertDatabaseHas('band_member_setups', [
            'band_member_id'    => $member->id,
            'name'              => 'Electric Guitar Rig',
        ]);
    });

    it('allows a member to create their own setup', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        $this->actingAsMember($member->id);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", [
            'name'              => 'Bass Rig',
            'signal_chain_type' => 'direct_mono',
        ])->assertCreated();
    });

    it('forbids a member from creating a setup for another member', function () {
        $memberA = BandMember::create(['profile_id' => 1, 'first_name' => 'Alice', 'last_name' => 'A', 'can_login' => false]);
        $memberB = BandMember::create(['profile_id' => 1, 'first_name' => 'Bob',   'last_name' => 'B', 'can_login' => false]);
        $this->actingAsMember($memberA->id);

        $this->postJson("/api/band-profile/members/{$memberB->id}/setups", [
            'name'              => 'Hack',
            'signal_chain_type' => 'amp_mic',
        ])->assertForbidden();
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", ['signal_chain_type' => 'amp_mic'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates signal_chain_type is required', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", ['name' => 'Rig'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['signal_chain_type']);
    });

    it('validates signal_chain_type must be a known value', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", [
            'name'              => 'Rig',
            'signal_chain_type' => 'invalid_type',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['signal_chain_type']);
    });

    it('accepts all known signal_chain_type values', function (string $type) {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);

        $this->postJson("/api/band-profile/members/{$member->id}/setups", [
            'name'              => "Rig {$type}",
            'signal_chain_type' => $type,
        ])->assertCreated();
    })->with([
        'modeler_mono', 'modeler_stereo', 'amp_mic', 'amp_mic_di', 'amp_di',
        'direct_mono', 'direct_stereo', 'drum_acoustic', 'drum_electronic',
        'drum_hybrid', 'vocal_mic', 'vocal_wireless', 'acoustic_di',
        'acoustic_mic', 'acoustic_mic_di', 'other',
    ]);
});

// ── PUT /api/band-profile/members/{member}/setups/{setup} ─────────────────────

describe('PUT /api/band-profile/members/{member}/setups/{setup}', function () {
    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", ['name' => 'New'])
            ->assertUnauthorized();
    });

    it('updates a setup', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Old Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", ['name' => 'New Rig'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Rig');
    });

    it('returns 404 if setup belongs to a different member', function () {
        $this->actingAsAdmin();
        $memberA = BandMember::create(['profile_id' => 1, 'first_name' => 'A', 'last_name' => 'A', 'can_login' => false]);
        $memberB = BandMember::create(['profile_id' => 1, 'first_name' => 'B', 'last_name' => 'B', 'can_login' => false]);
        $setup   = BandMemberSetup::create(['band_member_id' => $memberB->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$memberA->id}/setups/{$setup->id}", ['name' => 'X'])
            ->assertNotFound();
    });
});

// ── DELETE /api/band-profile/members/{member}/setups/{setup} ──────────────────

describe('DELETE /api/band-profile/members/{member}/setups/{setup}', function () {
    it('returns 401 without authentication', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->deleteJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}")
            ->assertUnauthorized();
    });

    it('deletes a setup', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Gone Rig', 'signal_chain_type' => 'amp_mic']);

        $this->deleteJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}")->assertNoContent();

        $this->assertDatabaseMissing('band_member_setups', ['id' => $setup->id]);
    });

    it('allows a member to delete their own setup', function () {
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $this->actingAsMember($member->id);
        $setup = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Own Rig', 'signal_chain_type' => 'direct_mono']);

        $this->deleteJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}")->assertNoContent();
    });
});

// ── GET /api/band-profile/member-setups (all setups, admin only) ──────────────

describe('GET /api/band-profile/member-setups', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/band-profile/member-setups')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/band-profile/member-setups')->assertForbidden();
    });

    it('returns all setups grouped by member', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);
        BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig A', 'signal_chain_type' => 'amp_mic']);
        BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig B', 'signal_chain_type' => 'direct_mono']);

        $data = $this->getJson('/api/band-profile/member-setups')
            ->assertSuccessful()
            ->json('data');

        expect($data[0]['member_id'])->toBe($member->id);
        expect(count($data[0]['setups']))->toBe(2);
    });
});

// ── Shared rig validation ─────────────────────────────────────────────────────
//
// A saved setup and a rider placement's override are the same shape and share
// one set of rules (App\Http\Requests\Concerns\ValidatesRig). These cover the
// parts of that shape a partial update must not trip over.

describe('rig validation', function () {
    function makeMemberWithSetup(): array
    {
        $member = BandMember::create([
            'profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false,
        ]);
        $setup = BandMemberSetup::create([
            'band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic',
        ]);

        return [$member, $setup];
    }

    it('accepts a partial update that sends only is_default', function () {
        $this->actingAsAdmin();
        [$member, $setup] = makeMemberWithSetup();

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", ['is_default' => true])
            ->assertSuccessful()
            ->assertJsonPath('data.is_default', true);
    });

    it('stores multiple monitor sends without dropping any', function () {
        $this->actingAsAdmin();
        [$member, $setup] = makeMemberWithSetup();

        $monitors = [
            ['id' => 'm1', 'label' => 'Wedge', 'type' => 'wedge', 'config' => 'mono',
             'mix_description' => 'vocals + kick', 'iem_own_pack' => false,
             'iem_transmitter_model' => '', 'iem_frequency' => ''],
            ['id' => 'm2', 'label' => 'IEM', 'type' => 'iem', 'config' => 'stereo',
             'mix_description' => 'full mix', 'iem_own_pack' => true,
             'iem_transmitter_model' => 'PSM300', 'iem_frequency' => '606.000'],
        ];

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", ['monitors' => $monitors])
            ->assertSuccessful()
            ->assertJsonCount(2, 'data.monitors')
            ->assertJsonPath('data.monitors.1.iem_frequency', '606.000');
    });

    it('rejects a monitor with an unknown type', function () {
        $this->actingAsAdmin();
        [$member, $setup] = makeMemberWithSetup();

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'monitors' => [[
                'id' => 'm1', 'label' => 'X', 'type' => 'headphones', 'config' => 'mono',
                'mix_description' => '', 'iem_own_pack' => false,
                'iem_transmitter_model' => '', 'iem_frequency' => '',
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['monitors.0.type']);
    });

    it('accepts a backline list rather than a single item', function () {
        $this->actingAsAdmin();
        [$member, $setup] = makeMemberWithSetup();

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'backline' => [
                ['id' => 'b1', 'needed' => true, 'category' => 'drum_kit', 'name' => 'Kit',
                 'brand_preference' => 'Pearl', 'specs' => '5-piece', 'notes' => ''],
                ['id' => 'b2', 'needed' => false, 'category' => 'other', 'name' => 'Rug',
                 'brand_preference' => '', 'specs' => '', 'notes' => 'brings own'],
            ],
        ])
            ->assertSuccessful()
            ->assertJsonCount(2, 'data.backline');
    });
});
