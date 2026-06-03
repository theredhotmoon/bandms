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

    it('accepts optional JSON section fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tech-riders', [
            'name'            => 'Full Rider',
            'stage_plot_data' => [['id' => 'pos-1', 'x' => 50, 'y' => 50]],
            'inputs'          => [['channel' => 1, 'instrument' => 'Kick']],
        ])->assertCreated();
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
            ->assertJsonStructure(['data' => ['id', 'name', 'is_active', 'stage_plot_data', 'inputs', 'gig_lineup']]);
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

        $this->putJson("/api/tech-riders/{$rider->id}", ['inputs' => []])
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
