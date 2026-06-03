<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Laravel\Passport\Passport;

// The login endpoint calls $user->createToken() which requires a Passport
// personal access client. Create it via artisan before each auth test.
beforeEach(function () {
    Artisan::call('passport:client', [
        '--personal'       => true,
        '--name'           => 'Test Personal Access Client',
        '--no-interaction' => true,
    ]);
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────

describe('POST /api/auth/login', function () {
    it('returns a token on valid credentials', function () {
        $user = User::factory()->create([
            'email'    => 'band@example.com',
            'password' => bcrypt('secret123'),
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'band@example.com',
            'password' => 'secret123',
        ])->assertSuccessful()
          ->assertJsonStructure(['token', 'user'])
          ->assertJsonPath('user.email', 'band@example.com');
    });

    it('returns 401 on wrong password', function () {
        User::factory()->create(['email' => 'wrong@example.com', 'password' => bcrypt('correct')]);

        $this->postJson('/api/auth/login', [
            'email'    => 'wrong@example.com',
            'password' => 'incorrect',
        ])->assertUnauthorized()
          ->assertJsonPath('message', 'The provided credentials are incorrect.');
    });

    it('returns 401 when email does not exist', function () {
        $this->postJson('/api/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'whatever',
        ])->assertUnauthorized();
    });

    it('validates email is required', function () {
        $this->postJson('/api/auth/login', ['password' => 'secret'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('validates email must be a valid email address', function () {
        $this->postJson('/api/auth/login', ['email' => 'not-an-email', 'password' => 'secret'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('validates password is required', function () {
        $this->postJson('/api/auth/login', ['email' => 'band@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    });
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────────

describe('POST /api/auth/logout', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    });

    it('logs out an authenticated user and revokes the token', function () {
        Passport::actingAs(User::factory()->create());

        $this->postJson('/api/auth/logout')
            ->assertSuccessful()
            ->assertJsonPath('message', 'Logged out.');
    });
});
