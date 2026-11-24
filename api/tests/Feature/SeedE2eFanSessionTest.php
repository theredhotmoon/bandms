<?php

use App\Models\FanAccount;
use Illuminate\Support\Facades\Artisan;

it('seeds a fan that signs in with the password it was given', function () {
    Artisan::call('e2e:seed-fan-session', ['--password' => 'correct horse', '--force' => true]);
    $seeded = json_decode(trim(Artisan::output()), true);

    expect($seeded['email'])->toBe(strtolower($seeded['email']));
    expect(FanAccount::find($seeded['fan_id'])->password_hash)->not->toBeNull();

    $this->postJson('/api/fan/auth/login', ['email' => $seeded['email'], 'password' => 'correct horse'])->assertOk();
    $this->postJson('/api/fan/auth/login', ['email' => $seeded['email'], 'password' => 'wrong'])->assertStatus(422);
});

it('seeds a link-only fan when no password is given', function () {
    Artisan::call('e2e:seed-fan-session', ['--force' => true]);
    $seeded = json_decode(trim(Artisan::output()), true);

    expect(FanAccount::find($seeded['fan_id'])->password_hash)->toBeNull();
});
