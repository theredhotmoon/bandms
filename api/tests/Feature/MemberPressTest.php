<?php

use App\Models\BandMember;
use App\Models\PressRelease;
use App\Models\SiteDirtyArea;
use Illuminate\Support\Facades\DB;

// Members a press article is about, through the shared `memberables` pivot.

function pressMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Press',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function memberPress(?string $published = '2026-01-01'): PressRelease
{
    return PressRelease::create([
        'profile_id' => 1, 'url' => 'https://example.com/' . uniqid(), 'published_at' => $published,
    ]);
}

beforeEach(fn () => $this->createProfile());

describe('press linked to members', function () {
    it('links several members when an article is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [pressMember('Ania'), pressMember('Bartek')];

        $id = $this->postJson('/api/press-releases', [
            'url' => 'https://example.com/interview', 'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(PressRelease::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [pressMember('Ania'), pressMember('Bartek')];
        $pr = memberPress();
        $pr->members()->sync([$a->id]);

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => $pr->url, 'member_ids' => [$b->id]])
            ->assertOk()->assertJsonPath('data.member_ids', [$b->id]);
        expect($pr->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => $pr->url, 'og_title' => 'Renamed'])->assertOk();
        expect($pr->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('serves member_ids on the show endpoint, which seeds the admin form', function () {
        $member = pressMember();
        $pr = memberPress();
        $pr->members()->sync([$member->id]);

        $this->getJson("/api/press-releases/{$pr->id}")->assertOk()->assertJsonPath('data.member_ids', [$member->id]);
    });

    it('marks member pages dirty only when the members change', function () {
        $this->actingAsAdmin();
        $member = pressMember();
        $pr = memberPress();

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => $pr->url, 'member_ids' => [$member->id]])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/press-releases/{$pr->id}", ['url' => $pr->url, 'member_ids' => [$member->id], 'og_title' => 'X'])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeFalse();
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();
        $pr = memberPress();

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => $pr->url, 'member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('are unlinked when the article is deleted, under the "press_release" alias', function () {
        $pr = memberPress();
        $pr->members()->sync([pressMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('press_release');

        $pr->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — press', function () {
    it('lists the ids of every article about a member, newest first, undated last', function () {
        $member = pressMember();
        $older = memberPress('2024-01-01');
        $newer = memberPress('2026-01-01');
        $undated = memberPress(null);
        foreach ([$older, $undated, $newer] as $p) {
            $p->members()->sync([$member->id]);
        }

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.press_release_ids', [$newer->id, $older->id, $undated->id]);
    });
});
