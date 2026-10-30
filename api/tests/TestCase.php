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

    /**
     * A plain user a superadmin has allowed both assistant features — what the
     * assistant tests need now that access is per user (users default to none).
     */
    protected function actingAsAssistantUser(): User
    {
        $user = User::factory()->create(['can_translate' => true, 'can_enhance' => true]);
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
     * A post payload that passes the always-required fields — intro and one
     * tag, which every post needs, drafts included — so a test only spells
     * out what it is about. Its own keys win.
     */
    protected function validPost(array $fields): array
    {
        return $fields + [
            'intro'   => ['en' => 'Intro'],
            'tag_ids' => [\App\Models\Tag::factory()->create()->id],
        ];
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
