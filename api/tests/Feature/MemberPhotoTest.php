<?php

use App\Models\Album;
use App\Models\BandMember;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Passport;

// Members tagged on photos, through the polymorphic `memberables` pivot. A
// photo can show any number of members, and a member any number of photos.

function taggedMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'Tag',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

function taggablePhoto(bool $published = true): Photo
{
    $album = Album::create([
        'title' => 'Album ' . uniqid(),
        'published_at' => $published ? now()->subDay() : null,
    ]);

    return Photo::create(['album_id' => $album->id, 'image' => 'photos/x.jpg', 'sort_order' => 0]);
}

beforeEach(fn () => $this->createProfile());

describe('PUT /api/photos/{photo}/members', function () {
    it('tags several members on one photo', function () {
        $this->actingAsAdmin();
        [$a, $b] = [taggedMember('Ania'), taggedMember('Bartek')];
        $photo = taggablePhoto();

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => [$a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('data.member_ids', [$a->id, $b->id]);

        expect($photo->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces the tags rather than adding to them', function () {
        $this->actingAsAdmin();
        [$a, $b] = [taggedMember('Ania'), taggedMember('Bartek')];
        $photo = taggablePhoto();
        $photo->members()->sync([$a->id]);

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => [$b->id]])->assertOk();

        expect($photo->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('clears every tag with an empty list', function () {
        $this->actingAsAdmin();
        $photo = taggablePhoto();
        $photo->members()->sync([taggedMember()->id]);

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => []])
            ->assertOk()
            ->assertJsonPath('data.member_ids', []);
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();
        $photo = taggablePhoto();

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('requires authentication', function () {
        $photo = taggablePhoto();

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => []])->assertUnauthorized();
    });

    it('is admin-only', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));
        $photo = taggablePhoto();

        $this->putJson("/api/photos/{$photo->id}/members", ['member_ids' => []])->assertForbidden();
    });
});

describe('member photo links', function () {
    it('are removed when the photo is deleted', function () {
        $photo = taggablePhoto();
        $photo->members()->sync([taggedMember()->id]);

        $photo->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });

    it('are removed when the member is deleted', function () {
        $member = taggedMember();
        taggablePhoto()->members()->sync([$member->id]);

        $member->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });

    it('are stored under the "photo" alias, not the class name', function () {
        taggablePhoto()->members()->sync([taggedMember()->id]);

        expect(DB::table('memberables')->value('memberable_type'))->toBe('photo');
    });
});

describe('GET /api/band-profile/members — photos', function () {
    it('lists the photos a member is tagged in', function () {
        $member = taggedMember();
        $photo = taggablePhoto();
        $photo->members()->sync([$member->id]);

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonCount(1, 'data.0.photos')
            ->assertJsonPath('data.0.photos.0.id', $photo->id)
            ->assertJsonPath('data.0.photos.0.url', '/storage/photos/x.jpg');
    });

    it('lists a photo under every member tagged in it', function () {
        [$a, $b] = [taggedMember('Ania'), taggedMember('Bartek')];
        $photo = taggablePhoto();
        $photo->members()->sync([$a->id, $b->id]);

        $data = $this->getJson('/api/band-profile/members')->assertOk()->json('data');

        foreach ($data as $member) {
            expect(collect($member['photos'])->pluck('id')->all())->toBe([$photo->id]);
        }
    });

    it('leaves out photos from an unpublished album', function () {
        $member = taggedMember();
        taggablePhoto(published: false)->members()->sync([$member->id]);

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonCount(0, 'data.0.photos');
    });
});

describe('GET /api/band-profile/members — photo order', function () {
    it('lists featured photos first, then the newest album first, then album order', function () {
        $member = taggedMember();
        $old = Album::create(['title' => 'Old', 'taken_at' => '2024-05-01', 'published_at' => now()->subDay()]);
        $new = Album::create(['title' => 'New', 'taken_at' => '2026-05-01', 'published_at' => now()->subDay()]);
        $mk = fn (Album $a, int $order, bool $featured = false) => Photo::create([
            'album_id' => $a->id, 'image' => "photos/{$a->title}{$order}.jpg", 'sort_order' => $order, 'epk_featured' => $featured,
        ]);

        $oldFirst    = $mk($old, 0);
        $oldFeatured = $mk($old, 1, true);
        $newSecond   = $mk($new, 1);
        $newFirst    = $mk($new, 0);
        foreach ([$oldFirst, $oldFeatured, $newSecond, $newFirst] as $p) {
            $p->members()->sync([$member->id]);
        }

        $ids = collect($this->getJson('/api/band-profile/members')->assertOk()->json('data.0.photos'))->pluck('id')->all();

        expect($ids)->toBe([$oldFeatured->id, $newFirst->id, $newSecond->id, $oldFirst->id]);
    });
});

it('leaves out a tagged photo that has no image file', function () {
    $member = taggedMember();
    $photo = taggablePhoto();
    $photo->update(['image' => null]);
    $photo->members()->sync([$member->id]);

    $this->getJson('/api/band-profile/members')->assertOk()->assertJsonCount(0, 'data.0.photos');
});
