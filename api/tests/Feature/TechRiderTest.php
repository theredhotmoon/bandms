<?php

use App\Models\TechRider;

beforeEach(fn () => $this->createProfile());

function makeTechRider(array $attrs = []): TechRider
{
    return TechRider::create(array_merge([
        'profile_id' => 1,
        'name'       => 'Festival Rider',
        'is_active'  => false,
    ], $attrs));
}

// ── GET /api/tech-riders/active (public) ──────────────────────────────────────

describe('GET /api/tech-riders/active', function () {
    it('is publicly accessible without authentication', function () {
        makeTechRider(['is_active' => true]);
        $this->getJson('/api/tech-riders/active')->assertSuccessful();
    });

    it('returns the active rider', function () {
        makeTechRider(['name' => 'Draft',  'is_active' => false]);
        makeTechRider(['name' => 'Active', 'is_active' => true]);

        $this->getJson('/api/tech-riders/active')
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Active');
    });

    it('returns 404 when no active rider exists', function () {
        makeTechRider(['is_active' => false]);
        $this->getJson('/api/tech-riders/active')->assertNotFound();
    });
});

// ── GET /api/tech-riders ──────────────────────────────────────────────────────

describe('GET /api/tech-riders', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/tech-riders')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->getJson('/api/tech-riders')->assertForbidden();
    });

    it('returns all riders ordered by active first then updated_at', function () {
        $this->actingAsAdmin();
        makeTechRider(['name' => 'Draft A', 'is_active' => false]);
        makeTechRider(['name' => 'Active',  'is_active' => true]);
        makeTechRider(['name' => 'Draft B', 'is_active' => false]);

        $data = $this->getJson('/api/tech-riders')->assertSuccessful()->json('data');
        expect($data[0]['name'])->toBe('Active');
    });

    it('returns an empty list when there are no riders', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/tech-riders')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

// ── POST /api/tech-riders ─────────────────────────────────────────────────────

describe('POST /api/tech-riders', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/tech-riders', ['name' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->postJson('/api/tech-riders', ['name' => 'X'])->assertForbidden();
    });

    it('creates a new rider', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', ['name' => 'Club Show'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Club Show')
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('tech_riders', ['name' => 'Club Show', 'profile_id' => 1]);
    });

    it('creates an active rider and deactivates all others', function () {
        $this->actingAsAdmin();
        makeTechRider(['name' => 'Old', 'is_active' => true]);

        $this->postJson('/api/tech-riders', ['name' => 'New', 'is_active' => true])
            ->assertCreated()
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('tech_riders',    ['name' => 'New', 'is_active' => true]);
        $this->assertDatabaseHas('tech_riders',    ['name' => 'Old', 'is_active' => false]);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/tech-riders', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name max length is 255', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/tech-riders', ['name' => str_repeat('x', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('accepts placements and production extras', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', [
            'name'       => 'Full Rider',
            'placements' => [[
                'id'             => 'pos-1',
                'band_member_id' => null,
                'setup_id'       => null,
                'x'              => 50,
                'y'              => 50,
                'instruments'    => [],
                'overrides'      => [],
            ]],
            'extra_inputs' => [[
                'id'         => 'in-1',
                'instrument' => 'Talkback',
                'mic_di'     => 'Mic',
                'mic_model'  => 'SM58',
                'stand_type' => 'Desk',
                'notes'      => '',
            ]],
        ])->assertCreated();
    });

    it('accepts an instrument slot that carries no rig of its own', function () {
        $this->actingAsAdmin();

        // Which rig a musician plays is a property of the placement. The slot is
        // an icon on the stage canvas and nothing more, so it must validate
        // without a setup reference of any kind.
        $this->postJson('/api/tech-riders', [
            'name'       => 'Slots',
            'placements' => [[
                'id'             => 'pos-1',
                'band_member_id' => null,
                'setup_id'       => null,
                'x'              => 20,
                'y'              => 30,
                'instruments'    => [
                    ['id' => 'inst-1', 'type' => 'saxophone', 'label' => 'Tenor'],
                ],
                'overrides'      => [],
            ]],
        ])->assertCreated();
    });

    it('rejects a placement that is missing its coordinates', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', [
            'name'       => 'Broken',
            'placements' => [['id' => 'pos-1', 'band_member_id' => null, 'setup_id' => null, 'instruments' => [], 'overrides' => []]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['placements.0.x', 'placements.0.y']);
    });

    it('rejects an extra channel with an unknown mic/DI choice', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', [
            'name'         => 'Broken',
            'extra_inputs' => [[
                'id'         => 'in-1',
                'instrument' => 'Talkback',
                'mic_di'     => 'Telepathy',
                'mic_model'  => '',
                'stand_type' => '',
                'notes'      => '',
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['extra_inputs.0.mic_di']);
    });

    it('rejects a placement override with a bad signal chain type', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', [
            'name'       => 'Broken',
            'placements' => [[
                'id'             => 'pos-1',
                'band_member_id' => null,
                'setup_id'       => null,
                'x'              => 10,
                'y'              => 10,
                'instruments'    => [],
                'overrides'      => ['signal_chain_type' => 'kazoo'],
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['placements.0.overrides.signal_chain_type']);
    });
});

// ── GET /api/tech-riders/{techRider} ──────────────────────────────────────────

describe('GET /api/tech-riders/{techRider}', function () {
    it('returns 401 without authentication', function () {
        $rider = makeTechRider();
        $this->getJson("/api/tech-riders/{$rider->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = makeTechRider();
        $this->getJson("/api/tech-riders/{$rider->id}")->assertForbidden();
    });

    it('returns the rider with all sections', function () {
        $this->actingAsAdmin();
        $rider = makeTechRider(['name' => 'My Rider']);

        $this->getJson("/api/tech-riders/{$rider->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $rider->id)
            ->assertJsonPath('data.name', 'My Rider')
            ->assertJsonStructure([
                'data' => [
                    'id', 'name', 'is_active', 'placements', 'referenced_setups',
                    'extra_inputs', 'channel_order', 'power_notes', 'pa_foh', 'gig_lineup',
                ],
            ]);
    });

    it('returns 404 for a non-existent rider', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/tech-riders/99999')->assertNotFound();
    });
});

// ── PUT /api/tech-riders/{techRider} ──────────────────────────────────────────

describe('PUT /api/tech-riders/{techRider}', function () {
    it('returns 401 without authentication', function () {
        $rider = makeTechRider();
        $this->putJson("/api/tech-riders/{$rider->id}", ['name' => 'X'])->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = makeTechRider();
        $this->putJson("/api/tech-riders/{$rider->id}", ['name' => 'X'])->assertForbidden();
    });

    it('updates the rider name', function () {
        $this->actingAsAdmin();
        $rider = makeTechRider(['name' => 'Old Name']);

        $this->putJson("/api/tech-riders/{$rider->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('tech_riders', ['id' => $rider->id, 'name' => 'New Name']);
    });

    it('setting is_active=true deactivates all other riders', function () {
        $this->actingAsAdmin();
        $riderA = makeTechRider(['name' => 'A', 'is_active' => true]);
        $riderB = makeTechRider(['name' => 'B', 'is_active' => false]);

        $this->putJson("/api/tech-riders/{$riderB->id}", ['is_active' => true])
            ->assertSuccessful()
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('tech_riders', ['id' => $riderA->id, 'is_active' => false]);
        $this->assertDatabaseHas('tech_riders', ['id' => $riderB->id, 'is_active' => true]);
    });

    it('allows partial updates without touching other fields', function () {
        $this->actingAsAdmin();
        $rider = makeTechRider(['name' => 'Keep', 'is_active' => true]);

        $this->putJson("/api/tech-riders/{$rider->id}", ['extra_inputs' => []])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Keep')
            ->assertJsonPath('data.is_active', true);
    });

    it('returns 404 for a non-existent rider', function () {
        $this->actingAsAdmin();
        $this->putJson('/api/tech-riders/99999', ['name' => 'X'])->assertNotFound();
    });
});

// ── POST /api/tech-riders/{techRider}/activate ────────────────────────────────

describe('POST /api/tech-riders/{techRider}/activate', function () {
    it('returns 401 without authentication', function () {
        $rider = makeTechRider();
        $this->postJson("/api/tech-riders/{$rider->id}/activate")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = makeTechRider();
        $this->postJson("/api/tech-riders/{$rider->id}/activate")->assertForbidden();
    });

    it('activates a rider and deactivates all others', function () {
        $this->actingAsAdmin();
        $riderA = makeTechRider(['name' => 'Currently Active', 'is_active' => true]);
        $riderB = makeTechRider(['name' => 'Draft',            'is_active' => false]);

        $this->postJson("/api/tech-riders/{$riderB->id}/activate")
            ->assertSuccessful()
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('tech_riders', ['id' => $riderA->id, 'is_active' => false]);
        $this->assertDatabaseHas('tech_riders', ['id' => $riderB->id, 'is_active' => true]);
    });

    it('returns 404 for a non-existent rider', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/tech-riders/99999/activate')->assertNotFound();
    });
});

// ── DELETE /api/tech-riders/{techRider} ───────────────────────────────────────

describe('DELETE /api/tech-riders/{techRider}', function () {
    it('returns 401 without authentication', function () {
        $rider = makeTechRider();
        $this->deleteJson("/api/tech-riders/{$rider->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = makeTechRider();
        $this->deleteJson("/api/tech-riders/{$rider->id}")->assertForbidden();
    });

    it('deletes the rider and returns 204', function () {
        $this->actingAsAdmin();
        $rider = makeTechRider(['name' => 'Gone Rider']);

        $this->deleteJson("/api/tech-riders/{$rider->id}")->assertNoContent();
        $this->assertDatabaseMissing('tech_riders', ['id' => $rider->id]);
    });

    it('returns 404 for a non-existent rider', function () {
        $this->actingAsAdmin();
        $this->deleteJson('/api/tech-riders/99999')->assertNotFound();
    });
});

// ── Referenced setups ─────────────────────────────────────────────────────────
//
// A placement stores only a reference plus a per-gig override. The API has to
// ship the referenced setups with the rider, or the public token view has no
// way to resolve them — that shipment is what keeps one resolver serving every
// surface instead of a second implementation appearing on the server.

describe('referenced setups travel with the rider', function () {
    function riderWithPlacement(int $setupId): TechRider
    {
        return makeTechRider([
            'placements' => [[
                'id'             => 'pos-1',
                'band_member_id' => null,
                'setup_id'       => $setupId,
                'x'              => 40,
                'y'              => 60,
                'instruments'    => [],
                'overrides'      => [],
            ]],
        ]);
    }

    it('includes every setup the placements point at', function () {
        $this->actingAsAdmin();
        $member = \App\Models\BandMember::create([
            'profile_id' => 1, 'first_name' => 'Marek', 'last_name' => 'K', 'can_login' => false,
        ]);
        $setup = \App\Models\BandMemberSetup::create([
            'band_member_id'    => $member->id,
            'name'              => 'Acoustic kit',
            'signal_chain_type' => 'drum_acoustic',
            'monitors'          => [['id' => 'm1', 'label' => 'Wedge', 'type' => 'wedge', 'config' => 'mono',
                                     'mix_description' => '', 'iem_own_pack' => false,
                                     'iem_transmitter_model' => '', 'iem_frequency' => '']],
        ]);
        $rider = riderWithPlacement($setup->id);

        $this->getJson("/api/tech-riders/{$rider->id}")
            ->assertSuccessful()
            ->assertJsonPath("data.referenced_setups.{$setup->id}.name", 'Acoustic kit')
            ->assertJsonCount(1, "data.referenced_setups.{$setup->id}.monitors");
    });

    it('exposes them on the public token endpoint too', function () {
        $member = \App\Models\BandMember::create([
            'profile_id' => 1, 'first_name' => 'Ola', 'last_name' => 'W', 'can_login' => false,
        ]);
        $setup = \App\Models\BandMemberSetup::create([
            'band_member_id'    => $member->id,
            'name'              => 'Helix rig',
            'signal_chain_type' => 'modeler_stereo',
        ]);
        $rider = riderWithPlacement($setup->id);

        $this->getJson("/api/public/rider/{$rider->public_token}")
            ->assertSuccessful()
            ->assertJsonPath("data.referenced_setups.{$setup->id}.name", 'Helix rig');
    });

    it('returns an empty map when no placement references a setup', function () {
        $this->actingAsAdmin();
        $rider = makeTechRider();

        $this->getJson("/api/tech-riders/{$rider->id}")
            ->assertSuccessful()
            ->assertJsonCount(0, 'data.referenced_setups');
    });
});
