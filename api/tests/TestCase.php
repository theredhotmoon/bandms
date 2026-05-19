<?php

namespace Tests;

use App\Models\BandProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Passport;

abstract class TestCase extends BaseTestCase
{
    protected function actingAsUser(): User
    {
        $user = User::factory()->create();
        Passport::actingAs($user);

        return $user;
    }

    protected function actingAsAdmin(): User
    {
        $user = User::factory()->create(['role' => 'admin']);
        Passport::actingAs($user);

        return $user;
    }

    protected function actingAsMember(?int $memberId = null): User
    {
        $user = User::factory()->create([
            'role'           => 'member',
            'band_member_id' => $memberId,
        ]);
        Passport::actingAs($user);

        return $user;
    }

    /**
     * Creates the singleton BandProfile at ID=1, which every band-profile
     * endpoint requires. Uses a raw DB insert to guarantee the ID regardless
     * of auto-increment state after prior transaction rollbacks.
     */
    protected function createProfile(array $attributes = []): BandProfile
    {
        DB::table('band_profiles')->insert(array_merge([
            'id'         => 1,
            'name'       => 'Test Band',
            'created_at' => now()->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ], $attributes));

        return BandProfile::findOrFail(1);
    }
}
