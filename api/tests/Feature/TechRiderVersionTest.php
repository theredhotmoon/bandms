<?php

use App\Models\BandMember;
use App\Models\BandMemberSetup;
use App\Models\TechRider;
use App\Models\TechRiderVersion;

beforeEach(fn () => $this->createProfile());

function versionRider(array $attrs = []): TechRider
{
    return TechRider::create(array_merge([
        'profile_id' => 1,
        'name'       => 'Club show',
        'is_active'  => true,
    ], $attrs));
}

/** A rider with one musician placed on a saved rig — enough to snapshot. */
function riderWithMember(): array
{
    $member = BandMember::create([
        'profile_id' => 1, 'first_name' => 'Marek', 'last_name' => 'K', 'can_login' => false,
    ]);

    $setup = BandMemberSetup::create([
        'band_member_id'    => $member->id,
        'name'              => 'Acoustic kit',
        'signal_chain_type' => 'drum_acoustic',
        'inputs'            => [[
            'id' => 'in1', 'instrument' => 'Kick', 'mic_di' => 'Mic',
            'mic_model' => 'D112', 'stand_type' => '', 'notes' => '',
        ]],
    ]);

    $rider = versionRider([
        'placements' => [[
            'id'             => 'pos-1',
            'band_member_id' => $member->id,
            'setup_id'       => $setup->id,
            'x'              => 40,
            'y'              => 60,
            'instruments'    => [],
            'overrides'      => [],
        ]],
    ]);

    return [$rider, $member, $setup];
}

// ── POST /api/tech-riders/{techRider}/versions ────────────────────────────────

describe('publishing a rider', function () {
    it('returns 401 without authentication', function () {
        $rider = versionRider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = versionRider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertForbidden();
    });

    it('creates version 1 and marks it published', function () {
        $this->actingAsAdmin();
        $rider = versionRider();

        $this->postJson("/api/tech-riders/{$rider->id}/versions", ['notes' => 'Sent to Off Festival'])
            ->assertCreated()
            ->assertJsonPath('data.version_number', 1)
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.notes', 'Sent to Off Festival');
    });

    it('numbers versions per rider, not globally', function () {
        $this->actingAsAdmin();
        $a = versionRider(['name' => 'Club', 'is_active' => false]);
        $b = versionRider(['name' => 'Festival', 'is_active' => false]);

        $this->postJson("/api/tech-riders/{$a->id}/versions")->assertCreated();
        $this->postJson("/api/tech-riders/{$b->id}/versions")
            ->assertCreated()
            ->assertJsonPath('data.version_number', 1);
    });

    it('archives the previous version so only one is ever published', function () {
        $this->actingAsAdmin();
        $rider = versionRider();

        $first = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.id');
        $this->postJson("/api/tech-riders/{$rider->id}/versions")
            ->assertCreated()
            ->assertJsonPath('data.version_number', 2);

        expect(TechRiderVersion::find($first)->status)->toBe('archived');
        expect($rider->versions()->where('status', 'published')->count())->toBe(1);
    });

    it('gives every version its own public token', function () {
        $this->actingAsAdmin();
        $rider = versionRider();

        $one = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.public_token');
        $two = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.public_token');

        expect($one)->not->toBe($two);
        expect(strlen($one))->toBe(32);
    });

    it('rejects notes longer than the column allows', function () {
        $this->actingAsAdmin();
        $rider = versionRider();

        $this->postJson("/api/tech-riders/{$rider->id}/versions", ['notes' => str_repeat('x', 1001)])
            ->assertStatus(422);
    });
});

// ── The snapshot ──────────────────────────────────────────────────────────────
//
// A snapshot freezes what the resolver reads, not what it produced. That is
// what keeps app/src/utils/riderResolver.ts the only implementation of the
// derivation rules — see App\Services\TechRiderSnapshotBuilder.

describe('the snapshot', function () {
    it('freezes the rider, the rigs it references and the musicians it places', function () {
        $this->actingAsAdmin();
        [$rider, $member, $setup] = riderWithMember();

        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();
        $snapshot = TechRiderVersion::first()->snapshot;

        expect($snapshot['rider']['placements'])->toHaveCount(1);
        expect($snapshot['rider']['referenced_setups'][(string) $setup->id]['name'])->toBe('Acoustic kit');
        expect($snapshot['members'])->toHaveCount(1);
        expect($snapshot['members'][0]['first_name'])->toBe('Marek');
    });

    it('does not change when the musician later edits their saved rig', function () {
        $this->actingAsAdmin();
        [$rider, , $setup] = riderWithMember();

        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $setup->update(['name' => 'Renamed kit', 'inputs' => []]);

        $frozen = TechRiderVersion::first()->snapshot['rider']['referenced_setups'][(string) $setup->id];
        expect($frozen['name'])->toBe('Acoustic kit');
        expect($frozen['inputs'])->toHaveCount(1);
    });

    it('never carries admin-only member fields into a public document', function () {
        $this->actingAsAdmin();
        [$rider] = riderWithMember();

        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $frozenMember = TechRiderVersion::first()->snapshot['members'][0];
        expect($frozenMember)->not->toHaveKey('login_email');
        expect($frozenMember)->not->toHaveKey('can_login');
    });
});

// ── GET /api/public/rider/{token} ─────────────────────────────────────────────

describe('the public rider link', function () {
    it('returns 404 while the rider has never been published', function () {
        $rider = versionRider();

        $this->getJson("/api/public/rider/{$rider->public_token}")->assertNotFound();
    });

    it('serves the published version through the rider token', function () {
        $this->actingAsAdmin();
        [$rider] = riderWithMember();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $this->getJson("/api/public/rider/{$rider->public_token}")
            ->assertSuccessful()
            ->assertJsonPath('data.version.version_number', 1)
            ->assertJsonPath('data.rider.name', 'Club show')
            ->assertJsonCount(1, 'data.members');
    });

    it('follows the rider token forward as new versions are published', function () {
        $this->actingAsAdmin();
        $rider = versionRider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $this->getJson("/api/public/rider/{$rider->public_token}")
            ->assertSuccessful()
            ->assertJsonPath('data.version.version_number', 2);
    });

    it('keeps serving an archived version through its own token', function () {
        $this->actingAsAdmin();
        $rider = versionRider(['name' => 'As sent in August']);
        $old = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.public_token');

        $rider->update(['name' => 'Renamed in September']);
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $this->getJson("/api/public/rider/{$old}")
            ->assertSuccessful()
            ->assertJsonPath('data.version.version_number', 1)
            ->assertJsonPath('data.rider.name', 'As sent in August');
    });

    it('returns 404 for an unknown token', function () {
        $this->getJson('/api/public/rider/' . str_repeat('z', 32))->assertNotFound();
    });
});

// ── GET /api/tech-riders/{techRider}/versions ─────────────────────────────────

describe('listing versions', function () {
    it('returns 401 without authentication', function () {
        $rider = versionRider();
        $this->getJson("/api/tech-riders/{$rider->id}/versions")->assertUnauthorized();
    });

    it('lists the versions newest first', function () {
        $this->actingAsAdmin();
        $rider = versionRider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions");
        $this->postJson("/api/tech-riders/{$rider->id}/versions");

        $data = $this->getJson("/api/tech-riders/{$rider->id}/versions")->assertSuccessful()->json('data');

        expect($data)->toHaveCount(2);
        expect($data[0]['version_number'])->toBe(2);
        expect($data[0]['status'])->toBe('published');
    });

    it('does not include the snapshot payload', function () {
        $this->actingAsAdmin();
        $rider = versionRider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions");

        expect($this->getJson("/api/tech-riders/{$rider->id}/versions")->json('data.0'))
            ->not->toHaveKey('snapshot');
    });

    it('excludes versions belonging to another rider', function () {
        $this->actingAsAdmin();
        $mine  = versionRider(['name' => 'Mine',  'is_active' => false]);
        $other = versionRider(['name' => 'Other', 'is_active' => false]);
        $this->postJson("/api/tech-riders/{$other->id}/versions");

        $this->getJson("/api/tech-riders/{$mine->id}/versions")
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});

// ── DELETE /api/tech-rider-versions/{version} ─────────────────────────────────

describe('deleting a version', function () {
    it('refuses to delete the version the public link serves', function () {
        $this->actingAsAdmin();
        $rider = versionRider();
        $id = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.id');

        $this->deleteJson("/api/tech-rider-versions/{$id}")->assertStatus(422);
        $this->assertDatabaseHas('tech_rider_versions', ['id' => $id]);
    });

    it('deletes an archived version', function () {
        $this->actingAsAdmin();
        $rider = versionRider();
        $id = $this->postJson("/api/tech-riders/{$rider->id}/versions")->json('data.id');
        $this->postJson("/api/tech-riders/{$rider->id}/versions");

        $this->deleteJson("/api/tech-rider-versions/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('tech_rider_versions', ['id' => $id]);
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider   = versionRider();
        $version = $rider->versions()->create([
            'version_number' => 1, 'snapshot' => [], 'status' => 'archived',
        ]);

        $this->deleteJson("/api/tech-rider-versions/{$version->id}")->assertForbidden();
    });
});

// ── Cascade ───────────────────────────────────────────────────────────────────

it('drops the versions with the rider', function () {
    $this->actingAsAdmin();
    $rider = versionRider();
    $this->postJson("/api/tech-riders/{$rider->id}/versions");

    $this->deleteJson("/api/tech-riders/{$rider->id}")->assertNoContent();

    $this->assertDatabaseCount('tech_rider_versions', 0);
});
