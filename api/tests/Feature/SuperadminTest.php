<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Laravel\Passport\Passport;

// Superadmins decide who may spend the assistant's tokens. These pin who can
// be one, who can touch one, and that there is always one who can act.

function actingAsSuperadmin(): User
{
    $u = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
    Passport::actingAs($u);

    return $u;
}

it('lists the three flags for every user', function () {
    actingAsSuperadmin();
    $row = collect($this->getJson('/api/users')->assertOk()->json())->first();

    expect($row)->toHaveKeys(['is_superadmin', 'can_translate', 'can_enhance']);
});

it('lets a superadmin switch a user\'s features', function () {
    actingAsSuperadmin();
    $target = User::factory()->create(['role' => 'member']);

    $this->putJson("/api/users/{$target->id}", ['can_translate' => true, 'can_enhance' => true])
        ->assertOk()->assertJsonPath('can_translate', true)->assertJsonPath('can_enhance', true);
});

it('lets a superadmin make another admin superadmin', function () {
    actingAsSuperadmin();
    $target = User::factory()->create(['role' => 'admin']);

    $this->putJson("/api/users/{$target->id}", ['is_superadmin' => true])
        ->assertOk()->assertJsonPath('is_superadmin', true);
});

it('refuses superadmin for a non-admin role — they could never reach the Users page', function () {
    actingAsSuperadmin();
    $member = User::factory()->create(['role' => 'publisher']);

    $this->putJson("/api/users/{$member->id}", ['is_superadmin' => true])->assertStatus(422);
    $this->postJson('/api/users', [
        'first_name' => 'A', 'last_name' => 'B', 'email' => 'sa@example.com',
        'password' => 'secret123', 'password_confirmation' => 'secret123',
        'role' => 'member', 'is_superadmin' => true,
    ])->assertStatus(422);
});

it('refuses the flags from a regular admin but still saves the rest', function () {
    $this->actingAsAdmin();
    $target = User::factory()->create(['role' => 'member', 'first_name' => 'Old']);

    $this->putJson("/api/users/{$target->id}", ['can_enhance' => true])->assertForbidden();
    $this->putJson("/api/users/{$target->id}", ['first_name' => 'New'])->assertOk();

    expect($target->fresh())->can_enhance->toBeFalse()->first_name->toBe('New');
});

it('refuses the flags on create from a regular admin', function () {
    $this->actingAsAdmin();

    $this->postJson('/api/users', [
        'first_name' => 'A', 'last_name' => 'B', 'email' => 'ab@example.com',
        'password' => 'secret123', 'password_confirmation' => 'secret123',
        'role' => 'member', 'can_enhance' => true,
    ])->assertForbidden();
});

it('stops a regular admin from editing or deleting a superadmin', function () {
    $super = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
    $this->actingAsAdmin();

    $this->putJson("/api/users/{$super->id}", ['password' => 'takeover1', 'password_confirmation' => 'takeover1'])->assertForbidden();
    $this->putJson("/api/users/{$super->id}", ['role' => 'member'])->assertForbidden();
    $this->deleteJson("/api/users/{$super->id}")->assertForbidden();

    expect($super->fresh())->role->toBe('admin');
});

it('never leaves zero superadmins — demotion, including through a role change', function () {
    $me = actingAsSuperadmin();

    $this->putJson("/api/users/{$me->id}", ['is_superadmin' => false])->assertStatus(422);
    $this->putJson("/api/users/{$me->id}", ['role' => 'member'])->assertStatus(422);

    $other = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
    $this->putJson("/api/users/{$me->id}", ['is_superadmin' => false])->assertOk();
    expect($other->fresh()->is_superadmin)->toBeTrue();
});

it('never leaves zero superadmins — deletion', function () {
    $me = actingAsSuperadmin();
    $other = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);

    $this->deleteJson("/api/users/{$other->id}")->assertNoContent();

    // $me is now the last one; a fresh superadmin acting alone cannot delete it
    // after demoting itself, because then $me is last again.
    Passport::actingAs($other = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]));
    $this->putJson("/api/users/{$other->id}", ['is_superadmin' => false])->assertOk();
    // Not a superadmin any more (a real request reloads the user): cannot touch $me at all.
    Passport::actingAs($other->fresh());
    $this->deleteJson("/api/users/{$me->id}")->assertForbidden();
});

it('makes the admin a fresh install creates a superadmin', function () {
    putenv('ADMIN_EMAIL=first@example.com');
    putenv('ADMIN_PASSWORD=secret123');
    try {
        $this->seed(DatabaseSeeder::class);
    } finally {
        putenv('ADMIN_EMAIL');
        putenv('ADMIN_PASSWORD');
    }

    expect(User::where('email', 'first@example.com')->value('is_superadmin'))->toBeTruthy();
});

it('makes the admin bandms:create-admin creates a superadmin', function () {
    Artisan::call('bandms:create-admin', [
        '--email' => 'cli@example.com', '--password' => 'longsecret1234', '--first-name' => 'C', '--last-name' => 'L',
    ]);

    expect(User::where('email', 'cli@example.com')->value('is_superadmin'))->toBeTruthy();
});
