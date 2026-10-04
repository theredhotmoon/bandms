<?php

use App\Models\BandMember;
use App\Models\Clip;
use App\Models\SiteDirtyArea;
use Illuminate\Support\Facades\DB;

// Members in a clip, through the shared `memberables` pivot. A clip often
// shows several members.

function clipMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Clip',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function memberClip(?string $recordedOn = '2026-05-01'): Clip
{
    return Clip::create([
        'url' => 'https://www.youtube.com/watch?v=' . substr(md5(uniqid()), 0, 11),
        'provider' => 'youtube', 'category' => 'live', 'recorded_on' => $recordedOn,
    ]);
}

beforeEach(fn () => $this->createProfile());

describe('clips linked to members', function () {
    it('links several members when a clip is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [clipMember('Ania'), clipMember('Bartek')];

        $id = $this->postJson('/api/clips', [
            'url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(Clip::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [clipMember('Ania'), clipMember('Bartek')];
        $clip = memberClip();
        $clip->members()->sync([$a->id]);

        $this->putJson("/api/clips/{$clip->id}", ['member_ids' => [$b->id]])->assertOk();
        expect($clip->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/clips/{$clip->id}", ['category' => 'studio'])->assertOk();
        expect($clip->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/clips/' . memberClip()->id, ['member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('serves member_ids on the clips list, which seeds the admin form', function () {
        $member = clipMember();
        memberClip()->members()->sync([$member->id]);

        $this->getJson('/api/clips')->assertOk()->assertJsonPath('data.0.member_ids', [$member->id]);
    });

    it('marks member pages dirty only when the members change', function () {
        $this->actingAsAdmin();
        $member = clipMember();
        $clip = memberClip();

        $this->putJson("/api/clips/{$clip->id}", ['member_ids' => [$member->id]])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/clips/{$clip->id}", ['member_ids' => [$member->id], 'category' => 'studio'])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeFalse();
    });

    it('are unlinked when the clip is deleted, under the "clip" alias', function () {
        $clip = memberClip();
        $clip->members()->sync([clipMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('clip');

        $clip->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — clips', function () {
    it('lists the ids of a member\'s clips, most recently recorded first', function () {
        $member = clipMember();
        $older = memberClip('2024-01-01');
        $newer = memberClip('2026-01-01');
        $older->members()->sync([$member->id]);
        $newer->members()->sync([$member->id]);

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.clip_ids', [$newer->id, $older->id]);
    });
});
