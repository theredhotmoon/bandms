<?php

use App\Models\BandMember;
use App\Models\User;
use Laravel\Passport\Passport;

// A member's public page is built only while the About module's member_pages
// switch is on AND the member has not opted out. This covers the member half;
// the switch is an ordinary key in the About visibility bag.

function pageMember(array $attrs = []): BandMember
{
    return BandMember::create(array_merge([
        'profile_id' => 1, 'first_name' => 'Jan', 'last_name' => 'Kowalski',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ], $attrs));
}

describe('band member public page opt-out', function () {
    beforeEach(fn () => $this->createProfile());

    it('defaults to a public page, so existing pages and QR codes keep working', function () {
        pageMember();

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonPath('data.0.public_page', true);
    });

    it('lets a member switch their own page off', function () {
        $member = pageMember();
        $this->actingAsMember($member->id);

        $this->putJson("/api/band-profile/members/{$member->id}", ['public_page' => false])
            ->assertSuccessful()
            ->assertJsonPath('data.public_page', false);

        expect($member->fresh()->public_page)->toBeFalse();
    });

    it('serves the opt-out on the public endpoint the site build reads', function () {
        pageMember(['public_page' => false]);

        $this->getJson('/api/band-profile/members')
            ->assertJsonPath('data.0.public_page', false);
    });

    it('answers true from create when the request omits it', function () {
        $this->actingAsAdmin();

        // The response is built from the model create() returned, which never
        // read the column default back from the database.
        $this->postJson('/api/band-profile/members', ['first_name' => 'Anna', 'last_name' => 'Nowak'])
            ->assertCreated()
            ->assertJsonPath('data.public_page', true);
    });

    it('lets an admin set it on create', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['first_name' => 'Anna', 'last_name' => 'Nowak', 'public_page' => false])
            ->assertCreated()
            ->assertJsonPath('data.public_page', false);
    });

    it('rejects a non-boolean value', function () {
        $member = pageMember();
        $this->actingAsAdmin();

        $this->putJson("/api/band-profile/members/{$member->id}", ['public_page' => 'nope'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('public_page');
    });

    it('leaves the opt-out alone when an update omits it', function () {
        $member = pageMember(['public_page' => false]);
        $this->actingAsAdmin();

        $this->putJson("/api/band-profile/members/{$member->id}", ['bio' => 'New bio'])
            ->assertSuccessful()
            ->assertJsonPath('data.public_page', false);
    });
});

it('stores and serves the About member_pages switch', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/about', ['visibility' => ['member_pages' => false]])
        ->assertOk()
        ->assertJsonPath('data.visibility.member_pages', false);

    $this->getJson('/api/site-config')
        ->assertJsonPath('module_config.about.visibility.member_pages', false);
});
