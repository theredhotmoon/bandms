<?php

use App\Models\Author;
use App\Models\Band;
use App\Models\BandMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Passport;

// ── GET /api/authors ──────────────────────────────────────────────────────────

describe('GET /api/authors', function () {
    // Authors hold personal contact data and the bands each person handles,
    // so the reads sit behind the same admin gate as the writes.
    it('returns 401 without authentication', function () {
        $this->getJson('/api/authors')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/authors')->assertForbidden();
    });

    it('returns authors ordered by first name, then last name', function () {
        $this->actingAsAdmin();
        Author::create(['first_name' => 'Zara', 'last_name' => 'Adams']);
        Author::create(['first_name' => 'Alice', 'last_name' => 'Smith']);
        Author::create(['first_name' => 'Alice', 'last_name' => 'Jones']);

        $this->getJson('/api/authors')
            ->assertSuccessful()
            ->assertJsonPath('data.0.name', 'Alice Jones')
            ->assertJsonPath('data.1.name', 'Alice Smith')
            ->assertJsonPath('data.2.name', 'Zara Adams');
    });
});

// ── GET /api/authors/{author} ─────────────────────────────────────────────────

describe('GET /api/authors/{author}', function () {
    it('returns 401 without authentication', function () {
        $author = Author::create(['first_name' => 'Private Person']);

        $this->getJson("/api/authors/{$author->id}")->assertUnauthorized();
    });

    it('returns the author', function () {
        $this->actingAsAdmin();
        $author = Author::create(['first_name' => 'Bob', 'last_name' => 'Brown', 'email' => 'bob@music.com']);

        $this->getJson("/api/authors/{$author->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.first_name', 'Bob')
            ->assertJsonPath('data.last_name', 'Brown')
            ->assertJsonPath('data.name', 'Bob Brown')
            ->assertJsonPath('data.email', 'bob@music.com');
    });

    it('returns 404 for a non-existent author', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/authors/9999')->assertNotFound();
    });
});

// ── POST /api/authors ─────────────────────────────────────────────────────────

describe('POST /api/authors', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/authors', ['first_name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/authors', ['first_name' => 'Test'])->assertForbidden();
    });

    it('stores first and last name in separate columns', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['first_name' => 'Jane', 'last_name' => 'Journalist'])
            ->assertCreated()
            ->assertJsonPath('data.first_name', 'Jane')
            ->assertJsonPath('data.last_name', 'Journalist')
            ->assertJsonPath('data.name', 'Jane Journalist');

        $this->assertDatabaseHas('authors', ['first_name' => 'Jane', 'last_name' => 'Journalist']);
    });

    // A contact can be one word — a radio desk, a promoter's alias.
    it('accepts an author with no last name', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['first_name' => 'Radio 357'])
            ->assertCreated()
            ->assertJsonPath('data.last_name', null)
            ->assertJsonPath('data.name', 'Radio 357');
    });

    it('creates an author with all contact fields', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', [
            'first_name' => 'Full',
            'last_name'  => 'Contact',
            'email'      => 'full@press.com',
            'phone'      => '+48 123 456 789',
            'whatsapp'   => '+48 123 456 789',
            'facebook'   => 'https://facebook.com/full',
            'instagram'  => 'fullcontact',
            'notes'      => 'Met at a festival.',
        ])->assertCreated()
          ->assertJsonPath('data.email', 'full@press.com')
          ->assertJsonPath('data.notes', 'Met at a festival.');
    });

    it('stores country and preferred contact language as codes', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', [
            'first_name'       => 'Abroad',
            'country'          => 'DE',
            'contact_language' => 'de',
        ])->assertCreated()
          ->assertJsonPath('data.country', 'DE')
          ->assertJsonPath('data.contact_language', 'de');

        $this->assertDatabaseHas('authors', ['first_name' => 'Abroad', 'country' => 'DE', 'contact_language' => 'de']);
    });

    it('rejects a country or language outside the code lists', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['first_name' => 'Test', 'country' => 'Germany', 'contact_language' => 'xx'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['country', 'contact_language']);
    });

    it('validates first name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['email' => 'no-name@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name'])
            ->assertJsonMissingValidationErrors(['last_name']);
    });

    it('validates email must be a valid email address', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['first_name' => 'Test', 'email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });
});

// ── PUT /api/authors/{author} ─────────────────────────────────────────────────

describe('PUT /api/authors/{author}', function () {
    it('returns 401 without authentication', function () {
        $author = Author::create(['first_name' => 'A']);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'B'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $author = Author::create(['first_name' => 'A']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'B'])->assertForbidden();
    });

    it('updates an author', function () {
        $this->actingAsAdmin();
        $author = Author::create(['first_name' => 'Old', 'last_name' => 'Name', 'notes' => 'Old note']);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'New', 'last_name' => 'Surname', 'notes' => 'Updated note'])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'New Surname')
            ->assertJsonPath('data.notes', 'Updated note');
    });

    it('clears the last name when sent as null', function () {
        $this->actingAsAdmin();
        $author = Author::create(['first_name' => 'Ann', 'last_name' => 'Gone']);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'Ann', 'last_name' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Ann');

        expect($author->fresh()->last_name)->toBeNull();
    });

    it('clears country and contact language when sent as null', function () {
        $this->actingAsAdmin();
        $author = Author::create(['first_name' => 'A', 'country' => 'PL', 'contact_language' => 'pl']);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'A', 'country' => null, 'contact_language' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.country', null)
            ->assertJsonPath('data.contact_language', null);
    });

    it('returns 404 for a non-existent author', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/authors/9999', ['first_name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/authors/{author} ──────────────────────────────────────────────

describe('DELETE /api/authors/{author}', function () {
    it('returns 401 without authentication', function () {
        $author = Author::create(['first_name' => 'A']);

        $this->deleteJson("/api/authors/{$author->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $author = Author::create(['first_name' => 'A']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/authors/{$author->id}")->assertForbidden();
    });

    it('deletes an author', function () {
        $this->actingAsAdmin();
        $author = Author::create(['first_name' => 'Gone Author']);

        $this->deleteJson("/api/authors/{$author->id}")->assertNoContent();

        $this->assertDatabaseMissing('authors', ['id' => $author->id]);
    });

    it('returns 404 for a non-existent author', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/authors/9999')->assertNotFound();
    });
});

// ── Social links ──────────────────────────────────────────────────────────────

describe('author social links', function () {
    it('stores social links sent with a new author', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', [
            'first_name'   => 'Linked Author',
            'social_links' => [
                ['platform' => 'instagram', 'url' => 'https://instagram.com/linked'],
                ['platform' => 'twitter',   'url' => 'https://twitter.com/linked'],
            ],
        ])->assertCreated()
          ->assertJsonCount(2, 'data.social_links')
          ->assertJsonPath('data.social_links.0.url', 'https://instagram.com/linked');

        $author = Author::where('first_name', 'Linked Author')->firstOrFail();

        $this->assertDatabaseHas('social_links', [
            'author_id' => $author->id,
            'platform'  => 'instagram',
            'url'       => 'https://instagram.com/linked',
        ]);
    });

    it('returns the stored social links when the author is fetched', function () {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Fetch Me',
            'social_links' => [['platform' => 'facebook', 'url' => 'https://facebook.com/fetchme']],
        ])->json('data.id');

        $this->getJson("/api/authors/{$id}")
            ->assertSuccessful()
            ->assertJsonPath('data.social_links.0.platform', 'facebook')
            ->assertJsonPath('data.social_links.0.url', 'https://facebook.com/fetchme');
    });

    it('replaces social links on update', function () {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Swap Links',
            'social_links' => [['platform' => 'instagram', 'url' => 'https://instagram.com/old']],
        ])->json('data.id');

        $this->putJson("/api/authors/{$id}", [
            'first_name'   => 'Swap Links',
            'social_links' => [['platform' => 'website', 'url' => 'https://swap.example.com']],
        ])->assertSuccessful()
          ->assertJsonCount(1, 'data.social_links')
          ->assertJsonPath('data.social_links.0.url', 'https://swap.example.com');

        $this->assertDatabaseMissing('social_links', ['url' => 'https://instagram.com/old']);
    });

    it('keeps author links out of the band profile social links', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', [
            'first_name'   => 'Not The Band',
            'social_links' => [['platform' => 'instagram', 'url' => 'https://instagram.com/journalist']],
        ])->assertCreated();

        $urls = collect($this->getJson('/api/band-profile/social-links')->json('data'))->pluck('url');

        expect($urls)->not->toContain('https://instagram.com/journalist');
    });

    it('stores an explicit position for each social link', function () {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Ordered Author',
            'social_links' => [
                ['platform' => 'website',   'url' => 'https://first.example.com'],
                ['platform' => 'instagram', 'url' => 'https://instagram.com/second'],
                ['platform' => 'twitter',   'url' => 'https://twitter.com/third'],
            ],
        ])->json('data.id');

        // Position must come from the payload order, not default to 0 for all.
        $this->assertDatabaseHas('social_links', ['author_id' => $id, 'url' => 'https://first.example.com',    'position' => 0]);
        $this->assertDatabaseHas('social_links', ['author_id' => $id, 'url' => 'https://instagram.com/second', 'position' => 1]);
        $this->assertDatabaseHas('social_links', ['author_id' => $id, 'url' => 'https://twitter.com/third',    'position' => 2]);
    });

    it('reads links back in position order even when it disagrees with id order', function () {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Shuffled Author',
            'social_links' => [
                ['platform' => 'website',   'url' => 'https://a.example.com'],
                ['platform' => 'instagram', 'url' => 'https://b.example.com'],
            ],
        ])->json('data.id');

        // Invert position without touching id, so id order and position order
        // disagree. Ordering that merely rode on auto-increment breaks here.
        DB::table('social_links')->where('author_id', $id)->where('url', 'https://a.example.com')->update(['position' => 1]);
        DB::table('social_links')->where('author_id', $id)->where('url', 'https://b.example.com')->update(['position' => 0]);

        $this->getJson("/api/authors/{$id}")
            ->assertSuccessful()
            ->assertJsonPath('data.social_links.0.url', 'https://b.example.com')
            ->assertJsonPath('data.social_links.1.url', 'https://a.example.com');
    });

    it('renumbers positions when links are reordered on update', function () {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Reorder Me',
            'social_links' => [
                ['platform' => 'website',   'url' => 'https://one.example.com'],
                ['platform' => 'instagram', 'url' => 'https://two.example.com'],
            ],
        ])->json('data.id');

        $this->putJson("/api/authors/{$id}", [
            'first_name'   => 'Reorder Me',
            'social_links' => [
                ['platform' => 'instagram', 'url' => 'https://two.example.com'],
                ['platform' => 'website',   'url' => 'https://one.example.com'],
            ],
        ])->assertSuccessful()
          ->assertJsonPath('data.social_links.0.url', 'https://two.example.com');

        $this->assertDatabaseHas('social_links', ['author_id' => $id, 'url' => 'https://two.example.com', 'position' => 0]);
        $this->assertDatabaseHas('social_links', ['author_id' => $id, 'url' => 'https://one.example.com', 'position' => 1]);
    });

    it('ignores owner foreign keys smuggled into a social link', function () {
        $this->actingAsAdmin();

        $profile = $this->createProfile();
        $member  = BandMember::create([
            'profile_id' => $profile->id, 'first_name' => 'Target', 'last_name' => 'Member',
            'is_current' => true, 'sort_order' => 0, 'can_login' => false,
        ]);

        $id = $this->postJson('/api/authors', [
            'first_name'   => 'Smuggler',
            'social_links' => [[
                'platform'   => 'instagram',
                'url'        => 'https://instagram.com/smuggled',
                'member_id'  => $member->id,
                'profile_id' => $profile->id,
                'venue_id'   => 999,
            ]],
        ])->assertCreated()->json('data.id');

        // SocialLink::$fillable carries every owner FK, so an unfiltered spread
        // would attach this link to the member's public profile as well.
        $this->assertDatabaseHas('social_links', [
            'author_id'  => $id,
            'url'        => 'https://instagram.com/smuggled',
            'member_id'  => null,
            'profile_id' => null,
            'venue_id'   => null,
        ]);
    });
});

// ── Author ↔ bands ────────────────────────────────────────────────────────────

describe('author bands', function () {
    it('attaches bands to an author on create', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Linked Band']);

        $this->postJson('/api/authors', ['first_name' => 'Band Contact', 'band_ids' => [$band->id]])
            ->assertCreated()
            ->assertJsonCount(1, 'data.bands')
            ->assertJsonPath('data.bands.0.name', 'Linked Band');

        $this->assertDatabaseHas('author_bands', ['band_id' => $band->id]);
    });

    it('syncs bands on update', function () {
        $this->actingAsAdmin();
        $old = Band::create(['name' => 'Dropped Band']);
        $new = Band::create(['name' => 'Added Band']);
        $author = Author::create(['first_name' => 'Switching Contact']);
        $author->bands()->attach($old);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'Switching Contact', 'band_ids' => [$new->id]])
            ->assertSuccessful()
            ->assertJsonCount(1, 'data.bands')
            ->assertJsonPath('data.bands.0.name', 'Added Band');

        $this->assertDatabaseMissing('author_bands', ['band_id' => $old->id]);
    });

    it('validates that every band id exists', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/authors', ['first_name' => 'Bad Bands', 'band_ids' => [9999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['band_ids.0']);
    });

    it('keeps bands when band_ids is omitted entirely', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Kept Band']);
        $author = Author::create(['first_name' => 'Renamed Contact']);
        $author->bands()->attach($band);

        $this->putJson("/api/authors/{$author->id}", ['first_name' => 'Renamed Contact 2'])
            ->assertSuccessful()
            ->assertJsonCount(1, 'data.bands');

        $this->assertDatabaseHas('author_bands', ['author_id' => $author->id, 'band_id' => $band->id]);
    });

    it('detaches the pivot row when a band is deleted', function () {
        $this->actingAsAdmin();
        $band = Band::create(['name' => 'Doomed Band']);
        $author = Author::create(['first_name' => 'Surviving Contact']);
        $author->bands()->attach($band);

        $band->delete();

        $this->assertDatabaseMissing('author_bands', ['author_id' => $author->id]);
        $this->assertDatabaseHas('authors', ['id' => $author->id]);
    });
});
