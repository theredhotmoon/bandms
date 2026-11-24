<?php

use App\Models\FanAccount;
use App\Models\FanSessionRow;
use App\Support\FanSession;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

it('opens a session that /fan/me accepts and stores only the hash', function () {
    $fan   = FanAccount::factory()->create();
    $token = FanSession::open($fan, 'password');

    $this->withToken($token)->getJson('/api/fan/me')->assertOk();

    $row = FanSessionRow::sole();
    expect($row->token_hash)->toBe(hash('sha256', $token))
        ->and($row->method)->toBe('password');
    expect($row->expires_at->diffInDays(now(), true))->toBeGreaterThan(179);
});

it('refuses an expired session', function () {
    $fan   = FanAccount::factory()->create();
    $token = FanSession::open($fan, 'link');
    FanSessionRow::query()->update(['expires_at' => now()->subMinute()]);

    $this->withToken($token)->getJson('/api/fan/me')->assertUnauthorized();
});

it('slides the expiry once a day, not on every request', function () {
    $fan   = FanAccount::factory()->create();
    $token = FanSession::open($fan, 'link');
    $first = FanSessionRow::sole()->expires_at;

    $this->travelTo(now()->startOfDay()->addDays(2)->addHour());
    $this->withToken($token)->getJson('/api/fan/me')->assertOk();
    $moved = FanSessionRow::sole();
    expect($moved->expires_at->gt($first))->toBeTrue()
        ->and($moved->last_used_at->isToday())->toBeTrue();

    $this->travel(2)->hours();
    $this->withToken($token)->getJson('/api/fan/me')->assertOk();
    $again = FanSessionRow::sole();
    expect($again->last_used_at->equalTo($moved->last_used_at))->toBeTrue()
        ->and($again->expires_at->equalTo($moved->expires_at))->toBeTrue();
});

it('still accepts a legacy cache session and moves it into the table', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_session:legacy-token', $fan->id, now()->addDays(30));

    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertOk();

    expect(Cache::get('fan_session:legacy-token'))->toBeNull();
    expect(FanSessionRow::where('token_hash', hash('sha256', 'legacy-token'))->value('method'))->toBe('link');
    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertOk();
});

it('refuses a legacy session of a fan whose legacy sessions were revoked', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_session:legacy-token', $fan->id, now()->addDays(30));
    FanSession::revokeOthers($fan, null);

    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertUnauthorized();
});

it('revokeOthers keeps the given row and deletes the rest', function () {
    $fan  = FanAccount::factory()->create();
    $keep = FanSessionRow::where('token_hash', hash('sha256', FanSession::open($fan, 'link')))->sole();
    FanSession::open($fan, 'password');
    FanSession::open($fan, 'google');
    $other = FanSession::open(FanAccount::factory()->create(), 'link');

    FanSession::revokeOthers($fan, $keep);

    expect(FanSessionRow::where('fan_account_id', $fan->id)->pluck('id')->all())->toBe([$keep->id]);
    expect(FanSessionRow::where('token_hash', hash('sha256', $other))->exists())->toBeTrue();
});

it('logout deletes the row', function () {
    $fan   = FanAccount::factory()->create();
    $token = FanSession::open($fan, 'link');

    $this->withToken($token)->postJson('/api/fan/auth/logout')->assertOk();

    expect(FanSessionRow::count())->toBe(0);
    $this->withToken($token)->getJson('/api/fan/me')->assertUnauthorized();
});

it('deletes the sessions with the fan account', function () {
    $fan = FanAccount::factory()->create();
    FanSession::open($fan, 'link');

    $fan->delete();

    expect(FanSessionRow::count())->toBe(0);
});

it('verifying a magic link opens a link session', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_magic:magic-token', $fan->id, now()->addMinutes(15));

    $res = $this->getJson('/api/fan/auth/verify?token=magic-token')->assertOk();

    $row = FanSessionRow::sole();
    expect($row->method)->toBe('link')
        ->and($row->token_hash)->toBe(hash('sha256', $res->json('token')));
});

it('opening a session clears that fan\'s expired rows', function () {
    $fan = FanAccount::factory()->create();
    FanSession::open($fan, 'link');
    FanSessionRow::query()->update(['expires_at' => now()->subDay()]);

    FanSession::open($fan, 'password');

    expect(FanSessionRow::count())->toBe(1)
        ->and(FanSessionRow::sole()->method)->toBe('password');
});

it('survives a parallel request that already migrated the same legacy token', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_session:legacy-token', $fan->id, now()->addDays(30));
    FanSessionRow::create([
        'fan_account_id' => $fan->id,
        'token_hash'     => hash('sha256', 'legacy-token'),
        'method'         => 'link',
        'last_used_at'   => now(),
        'expires_at'     => now()->addDays(180),
    ]);

    // The loser of the race: it missed the table before the winner inserted,
    // and now reaches the legacy branch with the cache key still in place.
    $migrate = new ReflectionMethod(FanSession::class, 'migrateLegacy');
    $row     = $migrate->invoke(null, 'legacy-token', hash('sha256', 'legacy-token'));

    expect($row)->not->toBeNull()
        ->and(FanSessionRow::where('token_hash', hash('sha256', 'legacy-token'))->count())->toBe(1)
        ->and(Cache::get('fan_session:legacy-token'))->toBeNull();
    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertOk();
});

it('marks legacy sessions revoked before it deletes any row', function () {
    $fan = FanAccount::factory()->create();
    FanSession::open($fan, 'link');

    $markedAtDelete = null;
    DB::listen(function ($query) use (&$markedAtDelete, $fan) {
        if (str_starts_with($query->sql, 'delete from "fan_sessions"')) {
            $markedAtDelete ??= Cache::has("fan_legacy_revoked:{$fan->id}");
        }
    });

    FanSession::revokeOthers($fan, null);

    expect($markedAtDelete)->toBeTrue();
});

it('drops a legacy session that was moving into the table while it was revoked', function () {
    $fan = FanAccount::factory()->create();
    Cache::put('fan_session:legacy-token', $fan->id, now()->addDays(30));
    // Revoked between this request's check and its insert.
    FanSessionRow::creating(function () use ($fan): void {
        FanSession::revokeOthers($fan, null);
    });

    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertUnauthorized();

    expect(FanSessionRow::count())->toBe(0);
});
