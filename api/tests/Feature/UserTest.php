<?php

use App\Models\BandMember;
use App\Models\User;
use Laravel\Passport\Passport;

// ── GET /api/users ────────────────────────────────────────────────────────────

describe('GET /api/users', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/users')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/users')->assertForbidden();
    });

    it('returns a list of users', function () {
        $this->actingAsAdmin();
        User::factory()->create(['first_name' => 'Bob', 'last_name' => 'Smith', 'role' => 'member']);

        $data = $this->getJson('/api/users')->assertSuccessful()->json();

        // At least our two users (admin + Bob)
        expect(count($data))->toBeGreaterThanOrEqual(2);
    });
});

// ── POST /api/users ───────────────────────────────────────────────────────────

describe('POST /api/users', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/users', ['email' => 'x@x.com'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/users', [])->assertForbidden();
    });

    it('creates a user', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/users', [
            'first_name'            => 'Alice',
            'last_name'             => 'Doe',
            'email'                 => 'alice@band.com',
            'password'              => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'                  => 'member',
        ])->assertCreated()
          ->assertJsonPath('email', 'alice@band.com')
          ->assertJsonPath('role', 'member');

        $this->assertDatabaseHas('users', ['email' => 'alice@band.com']);
    });

    it('creates a user linked to a band member', function () {
        $this->createProfile();
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

        $this->postJson('/api/users', [
            'first_name'            => 'John',
            'last_name'             => 'Doe',
            'email'                 => 'john@band.com',
            'password'              => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'                  => 'member',
            'band_member_id'        => $member->id,
        ])->assertCreated()
          ->assertJsonPath('band_member.id', $member->id);
    });

    it('validates first_name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/users', [
            'last_name' => 'Doe',
            'email'     => 'x@x.com',
            'password'  => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'      => 'admin',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['first_name']);
    });

    it('validates email must be unique', function () {
        $this->actingAsAdmin();
        User::factory()->create(['email' => 'taken@band.com']);

        $this->postJson('/api/users', [
            'first_name'            => 'X',
            'last_name'             => 'Y',
            'email'                 => 'taken@band.com',
            'password'              => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'                  => 'member',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['email']);
    });

    it('validates role must be a known value', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/users', [
            'first_name'            => 'X',
            'last_name'             => 'Y',
            'email'                 => 'x@x.com',
            'password'              => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'                  => 'superuser',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['role']);
    });

    it('accepts all valid roles', function (string $role) {
        $this->actingAsAdmin();
        $i = str_replace(['admin', 'member', 'publisher'], ['1', '2', '3'], $role);

        $this->postJson('/api/users', [
            'first_name'            => 'User',
            'last_name'             => 'Test',
            'email'                 => "user{$i}@test.com",
            'password'              => 'Secret12',
            'password_confirmation' => 'Secret12',
            'role'                  => $role,
        ])->assertCreated();
    })->with(['admin', 'member', 'publisher']);

    it('validates password must be confirmed', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/users', [
            'first_name'            => 'X',
            'last_name'             => 'Y',
            'email'                 => 'x@x.com',
            'password'              => 'Secret12',
            'password_confirmation' => 'WrongPass99',
            'role'                  => 'member',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['password']);
    });
});

// ── PUT /api/users/{user} ─────────────────────────────────────────────────────

describe('PUT /api/users/{user}', function () {
    it('returns 401 without authentication', function () {
        $user = User::factory()->create();

        $this->putJson("/api/users/{$user->id}", ['first_name' => 'X'])->assertUnauthorized();
    });

    it('updates a user', function () {
        $this->actingAsAdmin();
        $user = User::factory()->create(['first_name' => 'Old', 'role' => 'member']);

        $this->putJson("/api/users/{$user->id}", ['first_name' => 'New', 'role' => 'publisher'])
            ->assertSuccessful()
            ->assertJsonPath('first_name', 'New')
            ->assertJsonPath('role', 'publisher');
    });

    it('returns 404 for a non-existent user', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/users/9999', ['first_name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/users/{user} ──────────────────────────────────────────────────

describe('DELETE /api/users/{user}', function () {
    it('returns 401 without authentication', function () {
        $user = User::factory()->create();

        $this->deleteJson("/api/users/{$user->id}")->assertUnauthorized();
    });

    it('deletes a user', function () {
        $admin  = $this->actingAsAdmin();
        $target = User::factory()->create(['role' => 'member']);

        $this->deleteJson("/api/users/{$target->id}")->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    });

    it('cannot delete own account', function () {
        $admin = $this->actingAsAdmin();

        $this->deleteJson("/api/users/{$admin->id}")
            ->assertUnprocessable();
    });

    it('returns 404 for a non-existent user', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/users/9999')->assertNotFound();
    });
});
