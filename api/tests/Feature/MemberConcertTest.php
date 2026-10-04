<?php

use App\Models\BandMember;
use App\Models\Concert;
use App\Models\Venue;
use Illuminate\Support\Facades\DB;

// Who played each show, through the shared `memberables` pivot. Line-ups
// change, so a concert is linked to members explicitly — an unlinked concert
// does not mean "everyone played".

function gigMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Gig',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function gigConcert(string $date = '2026-06-01'): Concert
{
    $venue = Venue::firstOrCreate(['name' => 'Gig Venue'], ['city' => 'Kraków']);

    return Concert::create(['venue_id' => $venue->id, 'date' => $date]);
}

beforeEach(fn () => $this->createProfile());

describe('concerts linked to members', function () {
    it('links several members when a concert is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [gigMember('Ania'), gigMember('Bartek')];
        $venue = Venue::firstOrCreate(['name' => 'Gig Venue'], ['city' => 'Kraków']);

        $id = $this->postJson('/api/concerts', [
            'venue_id' => $venue->id, 'date' => '2026-07-01', 'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(Concert::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [gigMember('Ania'), gigMember('Bartek')];
        $concert = gigConcert();
        $concert->members()->sync([$a->id]);

        $this->putJson("/api/concerts/{$concert->id}", ['member_ids' => [$b->id]])->assertOk();
        expect($concert->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/concerts/{$concert->id}", ['start_time' => '20:00'])->assertOk();
        expect($concert->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('clears members with an empty list', function () {
        $this->actingAsAdmin();
        $concert = gigConcert();
        $concert->members()->sync([gigMember()->id]);

        $this->putJson("/api/concerts/{$concert->id}", ['member_ids' => []])
            ->assertOk()
            ->assertJsonPath('data.member_ids', []);
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();
        $concert = gigConcert();

        $this->putJson("/api/concerts/{$concert->id}", ['member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('keeps the "concert" alias clips already use, and unlinks on delete', function () {
        $concert = gigConcert();
        $concert->members()->sync([gigMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('concert');

        $concert->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — concerts', function () {
    it('lists the ids of the concerts a member played, newest first', function () {
        $member = gigMember();
        $older = gigConcert('2025-03-01');
        $newer = gigConcert('2026-03-01');
        $unrelated = gigConcert('2026-04-01');
        $older->members()->sync([$member->id]);
        $newer->members()->sync([$member->id]);

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.concert_ids', [$newer->id, $older->id]);
    });
});

it('marks member pages dirty only when the line-up actually changes', function () {
    $this->actingAsAdmin();
    $member = gigMember();
    $concert = gigConcert();

    $this->putJson("/api/concerts/{$concert->id}", ['member_ids' => [$member->id]])->assertOk();
    expect(\App\Models\SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();

    \App\Models\SiteDirtyArea::query()->delete();
    $this->putJson("/api/concerts/{$concert->id}", ['member_ids' => [$member->id], 'start_time' => '21:00'])->assertOk();
    expect(\App\Models\SiteDirtyArea::where('area', 'band-members')->exists())->toBeFalse();
});
