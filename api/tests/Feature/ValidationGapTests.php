<?php

use App\Models\BandMember;
use App\Models\BandMemberSetup;
use App\Models\SocialLink;
use App\Models\Tag;
use App\Models\Venue;

// ── VenueTest additions ───────────────────────────────────────────────────────
// Append this describe block to api/tests/Feature/VenueTest.php

describe('PUT /api/venues/{venue} — validation', function () {
    it('rejects an empty name string when name key is present', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'Original Name']);

        $this->putJson("/api/venues/{$venue->id}", ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('rejects a name exceeding 255 characters', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'Original Name']);

        $this->putJson("/api/venues/{$venue->id}", ['name' => str_repeat('a', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('accepts a name of exactly 255 characters', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'Original Name']);

        $this->putJson("/api/venues/{$venue->id}", ['name' => str_repeat('a', 255)])
            ->assertSuccessful();
    });

    it('omitting name entirely is valid (sometimes rule — field is optional on update)', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create(['name' => 'Original Name', 'city' => 'Warsaw']);

        $this->putJson("/api/venues/{$venue->id}", ['city' => 'Krakow'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Original Name');
    });
});

// ── PostTest additions ────────────────────────────────────────────────────────
// Append this describe block to api/tests/Feature/PostTest.php

describe('PUT /api/posts/{post} — validation', function () {
    it('rejects a title exceeding 255 characters when title key is present', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Original Title']);

        $this->putJson("/api/posts/{$post->id}", ['title' => str_repeat('t', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('accepts a title of exactly 255 characters', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Original Title']);

        $this->putJson("/api/posts/{$post->id}", ['title' => str_repeat('t', 255)])
            ->assertSuccessful();
    });

    it('rejects an empty title string when title key is present', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Original Title']);

        $this->putJson("/api/posts/{$post->id}", ['title' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('accepts a null content value (content is nullable)', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Original Title', 'content' => 'Some body text']);

        $this->putJson("/api/posts/{$post->id}", ['content' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.content', null);
    });

    it('accepts a non-empty content string', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create(['title' => 'Original Title']);

        $this->putJson("/api/posts/{$post->id}", ['content' => 'Updated body text'])
            ->assertSuccessful()
            ->assertJsonPath('data.content', 'Updated body text');
    });
});

// ── TagTest additions ─────────────────────────────────────────────────────────
// Append this describe block to api/tests/Feature/TagTest.php

describe('PUT /api/tags/{tag} — validation', function () {
    it('rejects a name exceeding 100 characters', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => str_repeat('a', 101)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('accepts a name of exactly 100 characters', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => str_repeat('a', 100)])
            ->assertSuccessful();
    });

    it('rejects an empty name string', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('rejects omitting name entirely (name is required on update)', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Rock', 'slug' => 'rock']);

        $this->putJson("/api/tags/{$tag->id}", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });
});

// ── SocialLinkTest additions — POST ──────────────────────────────────────────
// Append this describe block to api/tests/Feature/SocialLinkTest.php

describe('POST /api/band-profile/social-links — additional validation', function () {
    beforeEach(fn () => $this->createProfile());

    it('rejects a missing url', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', ['platform' => 'spotify'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });

    it('rejects a missing platform', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', ['url' => 'https://open.spotify.com/artist/test'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['platform']);
    });

    it('rejects when both url and platform are absent', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url', 'platform']);
    });

    it('rejects a url that is not a valid URL format', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'not-a-url',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['url']);
    });

    it('rejects a url that exceeds 500 characters', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/social-links', [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/' . str_repeat('a', 480),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['url']);
    });
});

// ── SocialLinkTest additions — PUT ───────────────────────────────────────────
// Append this describe block to api/tests/Feature/SocialLinkTest.php

describe('PUT /api/band-profile/social-links/{link} — url length validation', function () {
    beforeEach(fn () => $this->createProfile());

    it('rejects a url exceeding 500 characters', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://open.spotify.com/artist/test']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'spotify',
            'url'      => 'https://open.spotify.com/' . str_repeat('a', 480),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['url']);
    });

    it('accepts a url of exactly 500 characters', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://open.spotify.com/artist/test']);

        // Build a 500-char URL: scheme + host + path padding
        $base   = 'https://open.spotify.com/';
        $padded = $base . str_repeat('a', 500 - strlen($base));

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'spotify',
            'url'      => $padded,
        ])->assertSuccessful();
    });

    it('rejects an invalid url format on update', function () {
        $this->actingAsAdmin();
        $link = SocialLink::create(['profile_id' => 1, 'platform' => 'spotify', 'url' => 'https://open.spotify.com/artist/test']);

        $this->putJson("/api/band-profile/social-links/{$link->id}", [
            'platform' => 'spotify',
            'url'      => 'not-a-valid-url',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['url']);
    });
});

// ── MemberSetupTest additions ─────────────────────────────────────────────────
// Append this describe block to api/tests/Feature/MemberSetupTest.php

describe('PUT /api/band-profile/members/{member}/setups/{setup} — validation', function () {
    beforeEach(fn () => $this->createProfile());

    it('rejects an invalid signal_chain_type when the field is provided', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'signal_chain_type' => 'invalid_type',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['signal_chain_type']);
    });

    it('accepts a valid signal_chain_type on update', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'signal_chain_type' => 'direct_stereo',
        ])->assertSuccessful()
          ->assertJsonPath('data.signal_chain_type', 'direct_stereo');
    });

    it('allows omitting signal_chain_type entirely on update (sometimes rule)', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'name' => 'Updated Rig',
        ])->assertSuccessful()
          ->assertJsonPath('data.name', 'Updated Rig')
          ->assertJsonPath('data.signal_chain_type', 'amp_mic');
    });

    it('rejects an empty string for signal_chain_type when the field is provided', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'signal_chain_type' => '',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['signal_chain_type']);
    });

    it('rejects a name exceeding 255 characters when name is provided', function () {
        $this->actingAsAdmin();
        $member = BandMember::create(['profile_id' => 1, 'first_name' => 'J', 'last_name' => 'D', 'can_login' => false]);
        $setup  = BandMemberSetup::create(['band_member_id' => $member->id, 'name' => 'Rig', 'signal_chain_type' => 'amp_mic']);

        $this->putJson("/api/band-profile/members/{$member->id}/setups/{$setup->id}", [
            'name' => str_repeat('x', 256),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['name']);
    });
});
