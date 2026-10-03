<?php

use App\Models\BandMember;
use App\Models\Post;
use Illuminate\Support\Facades\DB;

// News linked to band members, through the shared `memberables` pivot. A post
// can be about several members, and a member can have any number of posts.

function newsMember(string $first = 'Jan'): BandMember
{
    return BandMember::create([
        'profile_id' => 1, 'first_name' => $first, 'last_name' => 'News',
        'is_current' => true, 'sort_order' => 0, 'can_login' => false,
    ]);
}

beforeEach(fn () => $this->createProfile());

describe('posts linked to members', function () {
    it('links several members when a post is created', function () {
        $this->actingAsAdmin();
        [$a, $b] = [newsMember('Ania'), newsMember('Bartek')];

        $id = $this->postJson('/api/posts', [
            'title' => ['en' => 'Studio diary'],
            'member_ids' => [$a->id, $b->id],
        ])->assertCreated()->assertJsonPath('data.member_ids', [$a->id, $b->id])->json('data.id');

        expect(Post::find($id)->members()->pluck('band_members.id')->all())->toEqualCanonicalizing([$a->id, $b->id]);
    });

    it('replaces the members on update, and leaves them alone when the key is absent', function () {
        $this->actingAsAdmin();
        [$a, $b] = [newsMember('Ania'), newsMember('Bartek')];
        $post = Post::factory()->create();
        $post->members()->sync([$a->id]);

        $this->putJson("/api/posts/{$post->id}", ['member_ids' => [$b->id]])->assertOk();
        expect($post->members()->pluck('band_members.id')->all())->toBe([$b->id]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])->assertOk();
        expect($post->members()->pluck('band_members.id')->all())->toBe([$b->id]);
    });

    it('clears the members with an empty list', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        $post->members()->sync([newsMember()->id]);

        $this->putJson("/api/posts/{$post->id}", ['member_ids' => []])
            ->assertOk()
            ->assertJsonPath('data.member_ids', []);
    });

    it('rejects an unknown member id', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', ['title' => ['en' => 'x'], 'member_ids' => [999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_ids.0');
    });

    it('are unlinked when the post is deleted, under the "post" alias', function () {
        $post = Post::factory()->create();
        $post->members()->sync([newsMember()->id]);
        expect(DB::table('memberables')->value('memberable_type'))->toBe('post');

        $post->delete();

        expect(DB::table('memberables')->count())->toBe(0);
    });
});

describe('GET /api/band-profile/members — posts', function () {
    it('lists the ids of a member\'s published posts, newest first', function () {
        $member = newsMember();
        $older = Post::factory()->create(['published_at' => now()->subDays(5)]);
        $newer = Post::factory()->create(['published_at' => now()->subDay()]);
        $draft = Post::factory()->draft()->create();
        foreach ([$older, $newer, $draft] as $p) {
            $p->members()->sync([$member->id]);
        }

        $this->getJson('/api/band-profile/members')
            ->assertOk()
            ->assertJsonPath('data.0.post_ids', [$newer->id, $older->id]);
    });
});
