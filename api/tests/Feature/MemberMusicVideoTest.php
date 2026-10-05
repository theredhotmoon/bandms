<?php

use App\Models\BandMember;
use App\Models\MusicVideo;
use App\Models\SiteDirtyArea;
use Illuminate\Support\Facades\DB;

// Members in a music video, through the shared `memberables` pivot.

function videoMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Video',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function memberVideo(?string $published = '2026-01-01'): MusicVideo
{
    return MusicVideo::create([
        'profile_id' => 1, 'title' => 'Video ' . uniqid(),
        'video_url' => 'https://www.youtube.com/watch?v=' . substr(md5(uniqid()), 0, 11),
        'published_at' => $published,
    ]);
}

beforeEach(fn () => $this->createProfile());

describe('music videos linked to members', function () {
    it('links several members when a video is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [videoMember('Ania'), videoMember('Bartek')];

        $id = $this->postJson('/api/music-videos', [
            'title' => 'Single', 'video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(MusicVideo::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [videoMember('Ania'), videoMember('Bartek')];
        $video = memberVideo();
        $video->members()->sync([$a->id]);

        $this->putJson("/api/music-videos/{$video->id}", ['member_ids' => [$b->id]])->assertOk();
        expect($video->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/music-videos/{$video->id}", ['title' => 'Renamed'])->assertOk();
        expect($video->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('serves member_ids on the list, which seeds the admin form', function () {
        $this->actingAsAdmin();
        $member = videoMember();
        memberVideo()->members()->sync([$member->id]);

        $this->getJson('/api/music-videos')->assertOk()->assertJsonPath('data.0.member_ids', [$member->id]);
    });

    it('marks member pages dirty only when the members change', function () {
        $this->actingAsAdmin();
        $member = videoMember();
        $video = memberVideo();

        $this->putJson("/api/music-videos/{$video->id}", ['member_ids' => [$member->id]])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/music-videos/{$video->id}", ['member_ids' => [$member->id], 'title' => 'X'])->assertOk();
        expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeFalse();
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/music-videos/' . memberVideo()->id, ['member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('are unlinked when the video is deleted, under the "music_video" alias', function () {
        $video = memberVideo();
        $video->members()->sync([videoMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('music_video');

        $video->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — music videos', function () {
    it('lists the ids of a member\'s published videos, newest first', function () {
        $member = videoMember();
        $older = memberVideo('2024-01-01');
        $newer = memberVideo('2026-01-01');
        $draft = memberVideo(null);
        foreach ([$older, $newer, $draft] as $v) {
            $v->members()->sync([$member->id]);
        }

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.music_video_ids', [$newer->id, $older->id]);
    });
});
