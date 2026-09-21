<?php

use App\Models\EpkVersion;
use App\Models\SiteDirtyArea;

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

    // Only clips the band flagged for the EPK, newest recording first; an
    // undated clip sorts after the dated ones.
    it('snapshots the clips flagged for the EPK, newest recording first', function () {
        $this->actingAsAdmin();
        $undated = \App\Models\Clip::factory()->create(['show_in_epk' => true, 'recorded_on' => null, 'title' => ['en' => 'Undated']]);
        $older   = \App\Models\Clip::factory()->create(['show_in_epk' => true, 'recorded_on' => '2025-01-01', 'title' => ['en' => 'Older']]);
        $newer   = \App\Models\Clip::factory()->create(['show_in_epk' => true, 'recorded_on' => '2026-03-03', 'title' => ['en' => 'Newer'], 'category' => 'studio']);
        \App\Models\Clip::factory()->create(['show_in_epk' => false, 'title' => ['en' => 'Hidden']]);

        $snapshot = $this->postJson('/api/epk-versions', [])->assertCreated()->json('data.snapshot');

        expect(array_column($snapshot['clips'], 'title'))->toBe(['Newer', 'Older', 'Undated']);
        expect($snapshot['clips'][0])->toMatchArray([
            'id' => $newer->id, 'provider' => 'youtube', 'embed_id' => 'dQw4w9WgXcQ',
            'category' => 'studio', 'recorded_on' => '2026-03-03',
        ]);
        expect($snapshot['clips'][0])->toHaveKey('url');
    });

    it('stores the snapshot so the public endpoint serves it as an object, not a JSON string', function () {
        $this->actingAsAdmin();
        $id = $this->postJson('/api/epk-versions')->assertCreated()->json('data.id');
        EpkVersion::whereKey($id)->update(['status' => 'published', 'published_at' => now()]);

        $data = $this->getJson('/api/band-profile/epk')->assertOk()->json('data');

        expect($data)->toBeArray()->toHaveKey('name');
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

    it('returns 422 when trying to publish the version that is already live', function () {
        $this->actingAsAdmin();
        $published = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);

        $this->postJson("/api/epk-versions/{$published->id}/publish")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This version is already live.');
    });

    it('restores an archived version and archives the one that was live', function () {
        $this->actingAsAdmin();
        $archived = EpkVersion::create(['version_number' => 1, 'snapshot' => ['v' => 1], 'status' => 'archived', 'published_at' => now()->subMonth()]);
        $live     = EpkVersion::create(['version_number' => 2, 'snapshot' => ['v' => 2], 'status' => 'published', 'published_at' => now()->subWeek()]);

        $this->postJson("/api/epk-versions/{$archived->id}/publish")
            ->assertSuccessful()
            ->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('epk_versions', ['id' => $live->id,     'status' => 'archived']);
        $this->assertDatabaseHas('epk_versions', ['id' => $archived->id, 'status' => 'published']);
        expect($archived->fresh()->published_at->greaterThan(now()->subMinute()))->toBeTrue();

        // The public endpoint serves whichever row is published — the restored snapshot.
        $this->getJson('/api/band-profile/epk')->assertJsonPath('data.v', 1);
    });

    it('marks band-profile dirty so the public site rebuilds', function () {
        $this->actingAsAdmin();
        $pending = makePendingVersion();

        $this->postJson("/api/epk-versions/{$pending->id}/publish")->assertSuccessful();

        expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeTrue();
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

    it('returns 422 when trying to delete the live version', function () {
        $this->actingAsAdmin();
        $published = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'published']);

        $this->deleteJson("/api/epk-versions/{$published->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This version is what the public EPK currently serves. Make another version live first.');
        $this->assertDatabaseHas('epk_versions', ['id' => $published->id]);
    });

    it('deletes an archived version and returns 204', function () {
        $this->actingAsAdmin();
        $archived = EpkVersion::create(['version_number' => 1, 'snapshot' => '{}', 'status' => 'archived']);

        $this->deleteJson("/api/epk-versions/{$archived->id}")->assertNoContent();
        $this->assertDatabaseMissing('epk_versions', ['id' => $archived->id]);
    });

    it('returns 404 for a non-existent version', function () {
        $this->actingAsAdmin();
        $this->deleteJson('/api/epk-versions/99999')->assertNotFound();
    });
});

// ── Repair migration for double-encoded snapshots ─────────────────────────────

describe('2026_09_17_000001_fix_double_encoded_epk_snapshots', function () {
    it('decodes rows stored as a JSON string and leaves correct rows alone', function () {
        DB::table('epk_versions')->insert([
            ['version_number' => 1, 'snapshot' => json_encode(json_encode(['name' => 'Old'])), 'status' => 'archived',  'created_at' => now(), 'updated_at' => now()],
            ['version_number' => 2, 'snapshot' => json_encode(['name' => 'New']),              'status' => 'published', 'created_at' => now(), 'updated_at' => now()],
        ]);

        (require database_path('migrations/2026_09_17_000001_fix_double_encoded_epk_snapshots.php'))->up();

        expect(EpkVersion::where('version_number', 1)->first()->snapshot)->toBe(['name' => 'Old'])
            ->and(EpkVersion::where('version_number', 2)->first()->snapshot)->toBe(['name' => 'New']);
    });
});
