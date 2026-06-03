<?php

use App\Models\EpkVersion;

beforeEach(fn () => $this->createProfile());

function makePendingVersion(string $reason = 'Initial release'): EpkVersion
{
    return EpkVersion::create([
        'version_number' => (EpkVersion::max('version_number') ?? 0) + 1,
        'release_reason' => $reason,
        'snapshot'       => '{}',
        'status'         => 'pending',
    ]);
}

// ── GET /api/epk-versions ─────────────────────────────────────────────────────

describe('GET /api/epk-versions', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/epk-versions')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->getJson('/api/epk-versions')->assertForbidden();
    });

    it('returns an empty list when there are no versions', function () {
        $this->actingAsAdmin();
        $this->getJson('/api/epk-versions')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns versions ordered by version_number descending', function () {
        $this->actingAsAdmin();
        EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);
        EpkVersion::create(['version_number' => 2, 'snapshot' => '{}', 'status' => 'pending']);

        $data = $this->getJson('/api/epk-versions')->assertSuccessful()->json('data');
        expect($data[0]['version_number'])->toBe(2);
        expect($data[1]['version_number'])->toBe(1);
    });
});

// ── POST /api/epk-versions ────────────────────────────────────────────────────

describe('POST /api/epk-versions', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/epk-versions')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->postJson('/api/epk-versions')->assertForbidden();
    });

    it('creates a new pending version with the next version number', function () {
        $this->actingAsAdmin();

        // EpkSnapshotBuilder::build() reads from the DB; createProfile() in
        // beforeEach has already seeded the profile, so no additional mocking needed.
        $this->postJson('/api/epk-versions', ['release_reason' => 'Added new bio'])
            ->assertCreated()
            ->assertJsonPath('data.version_number', 1)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.release_reason', 'Added new bio');

        $this->assertDatabaseHas('epk_versions', ['version_number' => 1, 'status' => 'pending']);
    });

    it('auto-increments version number beyond existing versions', function () {
        $this->actingAsAdmin();
        EpkVersion::create(['version_number' => 3, 'snapshot' => '{}', 'status' => 'archived']);

        $this->postJson('/api/epk-versions', [])
            ->assertCreated()
            ->assertJsonPath('data.version_number', 4);
    });

    it('returns 422 when a pending version already exists', function () {
        $this->actingAsAdmin();
        makePendingVersion('Already pending');

        $this->postJson('/api/epk-versions', [])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'A pending version already exists. Publish or discard it first.');
    });

    it('release_reason is optional', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/epk-versions', [])->assertCreated();
    });
});

// ── POST /api/epk-versions/{version}/publish ──────────────────────────────────

describe('POST /api/epk-versions/{version}/publish', function () {
    it('returns 401 without authentication', function () {
        $version = makePendingVersion();
        $this->postJson("/api/epk-versions/{$version->id}/publish")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $version = makePendingVersion();
        $this->postJson("/api/epk-versions/{$version->id}/publish")->assertForbidden();
    });

    it('publishes a pending version and archives the previously published one', function () {
        $this->actingAsAdmin();
        $published = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);
        $pending   = makePendingVersion();

        $this->postJson("/api/epk-versions/{$pending->id}/publish")
            ->assertSuccessful()
            ->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('epk_versions', ['id' => $published->id, 'status' => 'archived']);
        $this->assertDatabaseHas('epk_versions', ['id' => $pending->id,   'status' => 'published']);
    });

    it('returns 422 when trying to publish a non-pending version', function () {
        $this->actingAsAdmin();
        $published = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);

        $this->postJson("/api/epk-versions/{$published->id}/publish")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Only pending versions can be published.');
    });

    it('returns 422 when trying to publish an archived version', function () {
        $this->actingAsAdmin();
        $archived = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'archived']);

        $this->postJson("/api/epk-versions/{$archived->id}/publish")
            ->assertUnprocessable();
    });

    it('returns 404 for a non-existent version', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/epk-versions/99999/publish')->assertNotFound();
    });
});

// ── DELETE /api/epk-versions/{version} ────────────────────────────────────────

describe('DELETE /api/epk-versions/{version}', function () {
    it('returns 401 without authentication', function () {
        $version = makePendingVersion();
        $this->deleteJson("/api/epk-versions/{$version->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $version = makePendingVersion();
        $this->deleteJson("/api/epk-versions/{$version->id}")->assertForbidden();
    });

    it('deletes a pending version and returns 204', function () {
        $this->actingAsAdmin();
        $version = makePendingVersion();

        $this->deleteJson("/api/epk-versions/{$version->id}")->assertNoContent();
        $this->assertDatabaseMissing('epk_versions', ['id' => $version->id]);
    });

    it('returns 422 when trying to delete a published version', function () {
        $this->actingAsAdmin();
        $published = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);

        $this->deleteJson("/api/epk-versions/{$published->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Only pending versions can be discarded.');
    });

    it('returns 422 when trying to delete an archived version', function () {
        $this->actingAsAdmin();
        $archived = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'archived']);

        $this->deleteJson("/api/epk-versions/{$archived->id}")->assertUnprocessable();
    });

    it('returns 404 for a non-existent version', function () {
        $this->actingAsAdmin();
        $this->deleteJson('/api/epk-versions/99999')->assertNotFound();
    });
});
