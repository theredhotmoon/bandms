<?php

use App\Models\BandMember;
use App\Models\Release;
use App\Models\SiteDirtyArea;
use Illuminate\Support\Facades\DB;

// Who played on a release, through the shared `memberables` pivot. Line-ups
// change between records, so the links are explicit.

function releaseMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Rec',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function memberRelease(?string $date = '2026-01-01'): Release
{
    return Release::create(['profile_id' => 1, 'title' => ['en' => 'Record ' . uniqid()], 'type' => 'EP', 'release_date' => $date]);
}

beforeEach(fn () => $this->createProfile());

/** The release PUT is a full form (title and type required), as the admin sends it. */
function releaseForm(array $extra = []): array
{
    return ['title' => ['en' => 'Record'], 'type' => 'EP'] + $extra;
}

describe('releases linked to members', function () {
    it('links several members when a release is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [releaseMember('Ania'), releaseMember('Bartek')];

        $id = $this->postJson('/api/releases', [
            'title' => ['en' => 'Debut'], 'type' => 'LP', 'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(Release::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [releaseMember('Ania'), releaseMember('Bartek')];
        $release = memberRelease();
        $release->members()->sync([$a->id]);

        $this->putJson("/api/releases/{$release->id}", releaseForm(['member_ids' => [$b->id]]))->assertOk();
        expect($release->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/releases/{$release->id}", releaseForm(['label_name' => 'Indie']))->assertOk();
        expect($release->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('serves member_ids on the single release the admin form loads', function () {
        $member = releaseMember();
        $release = memberRelease();
        $release->members()->sync([$member->id]);

        $this->getJson("/api/releases/{$release->id}")->assertOk()->assertJsonPath('data.member_ids', [$member->id]);
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/releases/' . memberRelease()->id, releaseForm(['member_ids' => [999999]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('marks member pages dirty only when the members change', function () {
        $this->actingAsAdmin();
        $member = releaseMember();
        $release = memberRelease();

        $this->putJson("/api/releases/{$release->id}", releaseForm(['member_ids' => [$member->id]]))->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/releases/{$release->id}", releaseForm(['member_ids' => [$member->id], 'label_name' => 'X']))->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeFalse();
    });

    it('keeps the "release" alias clips already use, and unlinks on delete', function () {
        $release = memberRelease();
        $release->members()->sync([releaseMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('release');

        $release->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — releases', function () {
    it('lists the ids of the releases a member played on, newest first', function () {
        $member = releaseMember();
        $older = memberRelease('2020-01-01');
        $newer = memberRelease('2025-01-01');
        $older->members()->sync([$member->id]);
        $newer->members()->sync([$member->id]);

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.release_ids', [$newer->id, $older->id]);
    });
});
