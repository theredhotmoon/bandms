<?php

use App\Mail\RigConfirmationRequest;
use App\Models\BandMember;
use App\Models\Concert;
use App\Models\TechRider;
use App\Models\Venue;
use Illuminate\Support\Facades\Mail;

beforeEach(fn () => $this->createProfile());

function phase5Rider(array $attrs = []): TechRider
{
    return TechRider::create(array_merge([
        'profile_id' => 1,
        'name'       => 'Club show',
        'is_active'  => false,
    ], $attrs));
}

function phase5Member(array $attrs = []): BandMember
{
    return BandMember::create(array_merge([
        'profile_id' => 1,
        'first_name' => 'Marek',
        'last_name'  => 'K',
        'can_login'  => false,
        'is_current' => true,
    ], $attrs));
}

// ── POST /api/tech-riders/{id}/duplicate ──────────────────────────────────────

describe('duplicating a rider', function () {
    it('returns 401 without authentication', function () {
        $rider = phase5Rider();
        $this->postJson("/api/tech-riders/{$rider->id}/duplicate")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = phase5Rider();
        $this->postJson("/api/tech-riders/{$rider->id}/duplicate")->assertForbidden();
    });

    it('copies the stage plot and the production extras', function () {
        $this->actingAsAdmin();
        $rider = phase5Rider([
            'placements' => [[
                'id' => 'pos-1', 'band_member_id' => null, 'setup_id' => null,
                'x' => 30, 'y' => 40, 'instruments' => [], 'overrides' => [],
            ]],
            'extra_inputs' => [[
                'id' => 'in1', 'instrument' => 'Talkback', 'mic_di' => 'Mic',
                'mic_model' => '', 'stand_type' => '', 'notes' => '',
            ]],
            'pa_foh' => ['console_preference' => 'X32'],
        ]);

        $data = $this->postJson("/api/tech-riders/{$rider->id}/duplicate")
            ->assertSuccessful()
            ->json('data');

        expect($data['name'])->toBe('Club show (copy)');
        expect($data['placements'])->toHaveCount(1);
        expect($data['extra_inputs'][0]['instrument'])->toBe('Talkback');
        expect($data['pa_foh']['console_preference'])->toBe('X32');
    });

    it('gives the copy its own public token', function () {
        $this->actingAsAdmin();
        $rider = phase5Rider();

        $token = $this->postJson("/api/tech-riders/{$rider->id}/duplicate")->json('data.public_token');

        expect($token)->not->toBe($rider->public_token);
        expect(strlen($token))->toBe(32);
    });

    it('starts inactive even when the original is the active rider', function () {
        $this->actingAsAdmin();
        $rider = phase5Rider(['is_active' => true]);

        $this->postJson("/api/tech-riders/{$rider->id}/duplicate")
            ->assertSuccessful()
            ->assertJsonPath('data.is_active', false);

        expect($rider->fresh()->is_active)->toBeTrue();
    });

    it('carries no versions — the copy has never been sent', function () {
        $this->actingAsAdmin();
        $rider = phase5Rider();
        $this->postJson("/api/tech-riders/{$rider->id}/versions")->assertCreated();

        $copyId = $this->postJson("/api/tech-riders/{$rider->id}/duplicate")->json('data.id');

        $this->getJson("/api/tech-riders/{$copyId}/versions")
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('does not carry the concert over, so one gig keeps one rider', function () {
        $this->actingAsAdmin();
        $venue = Venue::create(['name' => 'Pod Minogą', 'city' => 'Poznań']);
        $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-12']);
        $rider = phase5Rider(['concert_id' => $concert->id]);

        $this->postJson("/api/tech-riders/{$rider->id}/duplicate")
            ->assertSuccessful()
            ->assertJsonPath('data.concert_id', null);
    });
});

// ── POST /api/concerts/{concert}/tech-rider ───────────────────────────────────

describe('starting a rider from a concert', function () {
    function phase5Concert(): Concert
    {
        $venue = Venue::create(['name' => 'Pod Minogą', 'city' => 'Poznań']);

        return Concert::create(['venue_id' => $venue->id, 'date' => '2026-09-12']);
    }

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $concert = phase5Concert();
        $this->postJson("/api/concerts/{$concert->id}/tech-rider")->assertForbidden();
    });

    it('names it after the venue and date, and links the concert', function () {
        $this->actingAsAdmin();
        $concert = phase5Concert();

        $this->postJson("/api/concerts/{$concert->id}/tech-rider")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Pod Minogą — 2026-09-12')
            ->assertJsonPath('data.concert_id', $concert->id);
    });

    it('pre-fills the lineup with the current members', function () {
        $this->actingAsAdmin();
        phase5Member(['first_name' => 'Marek']);
        phase5Member(['first_name' => 'Ola']);
        phase5Member(['first_name' => 'Gone', 'is_current' => false]);
        $concert = phase5Concert();

        $lineup = $this->postJson("/api/concerts/{$concert->id}/tech-rider")
            ->assertSuccessful()
            ->json('data.gig_lineup.regular_members');

        expect($lineup)->toHaveCount(2);
        expect($lineup[0]['is_available'])->toBeTrue();
    });

    it('starts inactive with an empty stage plot', function () {
        $this->actingAsAdmin();
        $concert = phase5Concert();

        $this->postJson("/api/concerts/{$concert->id}/tech-rider")
            ->assertSuccessful()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonCount(0, 'data.placements');
    });

    it('refuses a second rider for the same concert and points at the first', function () {
        $this->actingAsAdmin();
        $concert = phase5Concert();
        $first = $this->postJson("/api/concerts/{$concert->id}/tech-rider")->json('data.id');

        $this->postJson("/api/concerts/{$concert->id}/tech-rider")
            ->assertStatus(409)
            ->assertJsonPath('tech_rider_id', $first);
    });
});

// ── Confirmations ─────────────────────────────────────────────────────────────

describe('asking the band to confirm their rigs', function () {
    function riderWithLineup(array $memberIds): TechRider
    {
        return phase5Rider([
            'gig_lineup' => [
                'regular_members' => array_map(
                    fn ($id) => ['band_member_id' => $id, 'is_available' => true],
                    $memberIds,
                ),
                'temp_musicians' => [],
            ],
        ]);
    }

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $rider = phase5Rider();
        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")->assertForbidden();
    });

    it('mails every available member who can sign in', function () {
        Mail::fake();
        $this->actingAsAdmin();

        $canLogin = phase5Member(['first_name' => 'Marek', 'can_login' => true, 'login_email' => 'marek@example.test']);
        $noLogin  = phase5Member(['first_name' => 'Ola']);
        $rider = riderWithLineup([$canLogin->id, $noLogin->id]);

        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")
            ->assertSuccessful()
            ->assertJsonPath('requested', 1);

        Mail::assertSent(RigConfirmationRequest::class, 1);
        Mail::assertSent(
            RigConfirmationRequest::class,
            fn (RigConfirmationRequest $mail) => $mail->hasTo('marek@example.test'),
        );
    });

    it('skips musicians marked unavailable tonight', function () {
        Mail::fake();
        $this->actingAsAdmin();

        $member = phase5Member(['can_login' => true, 'login_email' => 'marek@example.test']);
        $rider = phase5Rider([
            'gig_lineup' => [
                'regular_members' => [['band_member_id' => $member->id, 'is_available' => false]],
                'temp_musicians'  => [],
            ],
        ]);

        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")->assertStatus(422);
        Mail::assertNothingSent();
    });

    it('records the request against the rider', function () {
        Mail::fake();
        $this->actingAsAdmin();

        $member = phase5Member(['can_login' => true, 'login_email' => 'marek@example.test']);
        $rider = riderWithLineup([$member->id]);

        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")->assertSuccessful();

        $this->assertDatabaseHas('tech_rider_confirmations', [
            'tech_rider_id'  => $rider->id,
            'band_member_id' => $member->id,
            'confirmed_at'   => null,
        ]);
    });

    it('clears a previous answer when the band is asked again', function () {
        Mail::fake();
        $this->actingAsAdmin();

        $member = phase5Member(['can_login' => true, 'login_email' => 'marek@example.test']);
        $rider = riderWithLineup([$member->id]);
        $rider->confirmations()->create([
            'band_member_id' => $member->id,
            'requested_at'   => now()->subWeek(),
            'confirmed_at'   => now()->subWeek(),
        ]);

        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")->assertSuccessful();

        expect($rider->confirmations()->first()->confirmed_at)->toBeNull();
    });

    it('lists who has answered and who has not', function () {
        Mail::fake();
        $this->actingAsAdmin();

        $member = phase5Member(['first_name' => 'Marek', 'can_login' => true, 'login_email' => 'm@example.test']);
        $rider = riderWithLineup([$member->id]);
        $this->postJson("/api/tech-riders/{$rider->id}/confirmations")->assertSuccessful();

        $data = $this->getJson("/api/tech-riders/{$rider->id}/confirmations")
            ->assertSuccessful()
            ->json('data');

        expect($data)->toHaveCount(1);
        expect($data[0]['member_name'])->toBe('Marek K');
        expect($data[0]['confirmed_at'])->toBeNull();
    });
});

describe('a musician confirming their own rig', function () {
    it('timestamps the confirmation against the rider', function () {
        $member = phase5Member();
        $rider = phase5Rider();
        $this->actingAsMember($member->id);

        $this->postJson("/api/tech-riders/{$rider->id}/confirm")
            ->assertSuccessful()
            ->assertJsonPath('data.band_member_id', $member->id);

        expect($rider->confirmations()->first()->confirmed_at)->not->toBeNull();
    });

    it('confirms for the caller, never for someone else', function () {
        $me    = phase5Member(['first_name' => 'Marek']);
        $other = phase5Member(['first_name' => 'Ola']);
        $rider = phase5Rider();
        $this->actingAsMember($me->id);

        $this->postJson("/api/tech-riders/{$rider->id}/confirm")->assertSuccessful();

        expect($rider->confirmations()->pluck('band_member_id')->all())->toBe([$me->id]);
        expect($rider->confirmations()->where('band_member_id', $other->id)->exists())->toBeFalse();
    });

    it('lists the riders still waiting on them', function () {
        $member = phase5Member();
        $rider = phase5Rider(['name' => 'Festival rider']);
        $rider->confirmations()->create(['band_member_id' => $member->id, 'requested_at' => now()]);
        $this->actingAsMember($member->id);

        $data = $this->getJson('/api/my-rider-confirmations')->assertSuccessful()->json('data');

        expect($data)->toHaveCount(1);
        expect($data[0]['rider']['name'])->toBe('Festival rider');
    });

    it('drops a rider off that list once confirmed', function () {
        $member = phase5Member();
        $rider = phase5Rider();
        $rider->confirmations()->create(['band_member_id' => $member->id, 'requested_at' => now()]);
        $this->actingAsMember($member->id);

        $this->postJson("/api/tech-riders/{$rider->id}/confirm")->assertSuccessful();

        $this->getJson('/api/my-rider-confirmations')->assertSuccessful()->assertJsonCount(0, 'data');
    });

    it('returns 401 without authentication', function () {
        $rider = phase5Rider();
        $this->postJson("/api/tech-riders/{$rider->id}/confirm")->assertUnauthorized();
    });
});

it('drops confirmations with the rider', function () {
    $this->actingAsAdmin();
    $member = phase5Member();
    $rider = phase5Rider();
    $rider->confirmations()->create(['band_member_id' => $member->id, 'requested_at' => now()]);

    $this->deleteJson("/api/tech-riders/{$rider->id}")->assertNoContent();

    $this->assertDatabaseCount('tech_rider_confirmations', 0);
});
