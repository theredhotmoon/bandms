<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Passport\Passport;

describe('POST /api/fan/auth/magic-link', function () {
    it('returns 200 and message for a valid email', function () {
        $response = $this->postJson('/api/fan/auth/magic-link', [
            'email' => 'fan@example.com',
        ]);

        $response->assertStatus(200)
            ->assertJson(['message' => 'Magic link sent to your email.'])
            ->assertJsonMissingPath('dev_link');
    });

    it('creates a new fan account if email not found', function () {
        $this->postJson('/api/fan/auth/magic-link', [
            'email' => 'newfan@example.com',
            'name'  => 'New Fan',
        ]);

        $this->assertDatabaseHas('fan_accounts', ['email' => 'newfan@example.com', 'name' => 'New Fan']);
    });

    it('returns 422 for an invalid email', function () {
        $this->postJson('/api/fan/auth/magic-link', ['email' => 'not-an-email'])
            ->assertStatus(422);
    });
});

describe('GET /api/fan/auth/verify', function () {
    it('returns 200 with token and fan data for a valid magic token', function () {
        $fan   = FanAccount::create(['email' => 'verify@example.com', 'name' => 'Test Fan']);
        $token = Str::random(64);
        Cache::put("fan_magic:{$token}", $fan->id, now()->addHours(24));

        $response = $this->getJson("/api/fan/auth/verify?token={$token}");

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'fan'])
            ->assertJsonPath('fan.email', 'verify@example.com');
    });

    it('returns 401 for an invalid token', function () {
        $this->getJson('/api/fan/auth/verify?token=invalidtoken')
            ->assertStatus(401);
    });

    it('returns 401 for an expired token', function () {
        // No cache entry = expired/invalid
        $this->getJson('/api/fan/auth/verify?token=' . Str::random(64))
            ->assertStatus(401);
    });
});

describe('GET /api/fan/me', function () {
    it('returns 200 with fan data when authenticated', function () {
        $fan          = FanAccount::create(['email' => 'me@example.com', 'name' => 'Me Fan']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        $this->getJson('/api/fan/me', ['Authorization' => "Bearer {$sessionToken}"])
            ->assertStatus(200)
            ->assertJsonPath('email', 'me@example.com');
    });

    it('returns 401 without authentication', function () {
        $this->getJson('/api/fan/me')->assertStatus(401);
    });

    it('returns 401 with invalid session token', function () {
        $this->getJson('/api/fan/me', ['Authorization' => 'Bearer invalidtoken'])
            ->assertStatus(401);
    });
});

describe('GET /api/fan/tickets', function () {
    it('returns 200 with ticket array when authenticated', function () {
        $fan          = FanAccount::create(['email' => 'ticketfan@example.com', 'name' => 'Ticket Fan']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        $this->getJson('/api/fan/tickets', ['Authorization' => "Bearer {$sessionToken}"])
            ->assertStatus(200)
            ->assertJsonIsArray();
    });

    it('returns tickets linked by fan_account_id', function () {
        $fan          = FanAccount::create(['email' => 'ticketowner@example.com', 'name' => 'Owner']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        $venue      = Venue::factory()->create(['name' => 'Test Venue']);
        $concert    = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-15']);
        $ticketType = ConcertTicketType::create(['concert_id' => $concert->id, 'name' => 'GA', 'sort_order' => 0]);

        Ticket::create([
            'uuid'                   => (string) Str::uuid(),
            'concert_ticket_type_id' => $ticketType->id,
            'status'                 => 'active',
            'holder_email'           => 'ticketowner@example.com',
            'holder_name'            => 'Owner',
            'fan_account_id'         => $fan->id,
        ]);

        $response = $this->getJson('/api/fan/tickets', ['Authorization' => "Bearer {$sessionToken}"]);
        $response->assertStatus(200);
        expect($response->json())->toHaveCount(1);
        expect($response->json('0.venue'))->toBe('Test Venue');
    });

    it('returns 401 without authentication', function () {
        $this->getJson('/api/fan/tickets')->assertStatus(401);
    });
});

describe('GET /api/fan/orders', function () {
    it('returns 200 with order array when authenticated', function () {
        $fan          = FanAccount::create(['email' => 'orderfan@example.com', 'name' => 'Order Fan']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        $this->getJson('/api/fan/orders', ['Authorization' => "Bearer {$sessionToken}"])
            ->assertStatus(200)
            ->assertJsonIsArray();
    });

    it('returns orders matching fan email', function () {
        $fan          = FanAccount::create(['email' => 'purchaser@example.com', 'name' => 'Purchaser']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        Order::factory()->create([
            'email'    => 'purchaser@example.com',
            'name'     => 'Purchaser',
            'status'   => 'paid',
            'currency' => 'EUR',
            'total'    => '25.00',
        ]);

        $response = $this->getJson('/api/fan/orders', ['Authorization' => "Bearer {$sessionToken}"]);
        $response->assertStatus(200);
        expect($response->json())->toHaveCount(1);
        expect($response->json('0.currency'))->toBe('EUR');
    });

    it('returns 401 without authentication', function () {
        $this->getJson('/api/fan/orders')->assertStatus(401);
    });
});

describe('GET /api/fan-accounts (admin list)', function () {
    it('returns 403 for a member role user', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/fan-accounts')->assertStatus(403);
    });

    it('returns 200 for an admin user', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/fan-accounts')->assertStatus(200);
    });

    it('returns 401 without authentication', function () {
        $this->getJson('/api/fan-accounts')->assertStatus(401);
    });
});

describe('POST /api/fan/auth/logout', function () {
    it('returns 200 and clears the session token', function () {
        $fan          = FanAccount::create(['email' => 'logout@example.com', 'name' => 'Logout Fan']);
        $sessionToken = Str::random(64);
        Cache::put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        $this->postJson('/api/fan/auth/logout', [], ['Authorization' => "Bearer {$sessionToken}"])
            ->assertStatus(200)
            ->assertJson(['message' => 'Logged out.']);

        expect(Cache::get("fan_session:{$sessionToken}"))->toBeNull();
    });

    it('returns 401 without authentication', function () {
        $this->postJson('/api/fan/auth/logout')->assertStatus(401);
    });
});
