<?php

use App\Models\BandMember;

// Every member gets a public page at /{lang}/{about}/{slug}, and that URL is
// printed as a QR code — so a slug is generated once and never moves.

function member(array $attrs = []): BandMember
{
    return BandMember::create(array_merge([
        'profile_id' => 1, 'first_name' => 'Jan', 'last_name' => 'Kowalski',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ], $attrs));
}

describe('band member slugs', function () {
    beforeEach(fn () => $this->createProfile());

    it('generates a slug from the name on create', function () {
        expect(member()->slug)->toBe('jan-kowalski');
    });

    it('transliterates Polish names', function () {
        expect(member(['first_name' => 'Łukasz', 'last_name' => 'Żółć'])->slug)->toBe('lukasz-zolc');
    });

    it('suffixes a duplicate name rather than colliding', function () {
        member();
        expect(member()->slug)->toBe('jan-kowalski-2');
        expect(member()->slug)->toBe('jan-kowalski-3');
    });

    it('keeps the slug when the member is renamed', function () {
        $m = member();
        $m->update(['first_name' => 'Janek']);

        expect($m->fresh()->slug)->toBe('jan-kowalski');
    });

    it('falls back to "member" for a name with no sluggable characters', function () {
        expect(member(['first_name' => '★', 'last_name' => '☆'])->slug)->toBe('member');
    });

    it('is served by the public members endpoint', function () {
        member();

        $this->getJson('/api/band-profile/members')
            ->assertSuccessful()
            ->assertJsonPath('data.0.slug', 'jan-kowalski');
    });

    it('is generated for a member created through the admin API', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['first_name' => 'Anna', 'last_name' => 'Nowak'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'anna-nowak');
    });

    it('is not changed by an admin update that renames the member', function () {
        $this->actingAsAdmin();
        $m = member();

        $this->putJson("/api/band-profile/members/{$m->id}", ['first_name' => 'Johnny', 'last_name' => 'K'])
            ->assertSuccessful()
            ->assertJsonPath('data.slug', 'jan-kowalski');
    });
});

describe('default gear validation', function () {
    beforeEach(fn () => $this->createProfile());

    it('rejects a gear item whose fields are not strings or whose type is unknown', function (array $item, string $error) {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['first_name' => 'G', 'last_name' => 'V', 'default_gear' => [$item]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors($error);
    })->with([
        'numeric label'  => [['type' => 'amp_head', 'label' => 12], 'default_gear.0.label'],
        'object model'   => [['type' => 'amp_head', 'brand_model' => ['x' => 1]], 'default_gear.0.brand_model'],
        'unknown type'   => [['type' => 'spaceship'], 'default_gear.0.type'],
    ]);

    it('accepts a well-formed gear item', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/members', ['first_name' => 'G', 'last_name' => 'V', 'default_gear' => [
            ['id' => 'a', 'type' => 'amp_head', 'label' => 'Main', 'brand_model' => 'Orange', 'own_gear' => true, 'notes' => ''],
        ]])->assertCreated();
    });
});

describe('default gear round trip', function () {
    beforeEach(fn () => $this->createProfile());

    // Laravel drops array keys with no rule from validated data, so every
    // field the admin sends must have one — or a save silently strips it.
    // The admin keys, removes and edits gear items by their id.
    it('keeps every gear field, the item id included, through create and update', function () {
        $this->actingAsAdmin();
        $item = ['id' => 'g-42', 'type' => 'amp_head', 'label' => 'Main', 'brand_model' => 'Orange', 'own_gear' => true, 'notes' => 'n'];

        $id = $this->postJson('/api/band-profile/members', ['first_name' => 'G', 'last_name' => 'R', 'default_gear' => [$item]])
            ->assertCreated()
            ->assertJsonPath('data.default_gear.0', $item)
            ->json('data.id');

        $this->putJson("/api/band-profile/members/{$id}", ['first_name' => 'G', 'last_name' => 'R', 'default_gear' => [$item]])
            ->assertOk()
            ->assertJsonPath('data.default_gear.0', $item);
    });
});
