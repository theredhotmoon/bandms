<?php

use App\Models\PressRelease;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/press-releases ───────────────────────────────────────────────────

describe('GET /api/press-releases', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/press-releases')->assertSuccessful();
    });

    it('returns press releases ordered by published_at desc', function () {
        PressRelease::create(['profile_id' => 1, 'url' => 'https://old.com', 'published_at' => '2023-01-01']);
        PressRelease::create(['profile_id' => 1, 'url' => 'https://new.com', 'published_at' => '2025-01-01', 'og_title' => 'New Article']);

        $this->getJson('/api/press-releases')
            ->assertSuccessful()
            ->assertJsonPath('data.0.og_title', 'New Article');
    });
});

// ── GET /api/press-releases/{pressRelease} ────────────────────────────────────

describe('GET /api/press-releases/{pressRelease}', function () {
    it('returns the press release', function () {
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com/article', 'og_title' => 'Great Review']);

        $this->getJson("/api/press-releases/{$pr->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.og_title', 'Great Review');
    });

    it('returns 404 for a non-existent press release', function () {
        $this->getJson('/api/press-releases/9999')->assertNotFound();
    });
});

// ── POST /api/press-releases ──────────────────────────────────────────────────

describe('POST /api/press-releases', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/press-releases', ['url' => 'https://example.com'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/press-releases', ['url' => 'https://example.com'])->assertForbidden();
    });

    it('creates a press release', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases', [
            'url'      => 'https://music-blog.com/great-review',
            'og_title' => 'Great Review',
        ])->assertCreated()
          ->assertJsonPath('data.og_title', 'Great Review');

        $this->assertDatabaseHas('press_releases', ['url' => 'https://music-blog.com/great-review']);
    });

    it('creates a featured press release', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases', [
            'url'      => 'https://rolling-stone.com/band',
            'featured' => true,
        ])->assertCreated()
          ->assertJsonPath('data.featured', true);
    });

    it('creates a press release with tags', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create(['name' => 'Review', 'slug' => 'review']);

        $this->postJson('/api/press-releases', [
            'url'     => 'https://example.com',
            'tag_ids' => [$tag->id],
        ])->assertCreated();

        $this->assertDatabaseHas('press_release_tags', ['tag_id' => $tag->id]);
    });

    it('validates url is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases', ['og_title' => 'No URL'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });

    it('validates url must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases', ['url' => 'not-a-url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });
});

// ── PUT /api/press-releases/{pressRelease} ────────────────────────────────────

describe('PUT /api/press-releases/{pressRelease}', function () {
    it('returns 401 without authentication', function () {
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com']);

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => 'https://new.com'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/press-releases/{$pr->id}", ['url' => 'https://new.com'])->assertForbidden();
    });

    it('updates a press release', function () {
        $this->actingAsAdmin();
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com', 'og_title' => 'Old Title']);

        $this->putJson("/api/press-releases/{$pr->id}", [
            'url'      => 'https://example.com',
            'og_title' => 'Updated Title',
            'featured' => true,
        ])->assertSuccessful()
          ->assertJsonPath('data.og_title', 'Updated Title')
          ->assertJsonPath('data.featured', true);
    });

    it('returns 404 for a non-existent press release', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/press-releases/9999', ['url' => 'https://example.com'])->assertNotFound();
    });
});

// ── DELETE /api/press-releases/{pressRelease} ─────────────────────────────────

describe('DELETE /api/press-releases/{pressRelease}', function () {
    it('returns 401 without authentication', function () {
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com']);

        $this->deleteJson("/api/press-releases/{$pr->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/press-releases/{$pr->id}")->assertForbidden();
    });

    it('deletes a press release', function () {
        $this->actingAsAdmin();
        $pr = PressRelease::create(['profile_id' => 1, 'url' => 'https://example.com']);

        $this->deleteJson("/api/press-releases/{$pr->id}")->assertNoContent();

        $this->assertDatabaseMissing('press_releases', ['id' => $pr->id]);
    });

    it('returns 404 for a non-existent press release', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/press-releases/9999')->assertNotFound();
    });
});

// ── POST /api/press-releases/fetch-meta ──────────────────────────────────────

describe('POST /api/press-releases/fetch-meta', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/press-releases/fetch-meta', ['url' => 'https://example.com'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/press-releases/fetch-meta', ['url' => 'https://example.com'])->assertForbidden();
    });

    it('validates url is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases/fetch-meta', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });

    it('validates url must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/press-releases/fetch-meta', ['url' => 'not-a-url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['url']);
    });

    it('returns parsed OG metadata from the URL', function () {
        $this->actingAsAdmin();

        $html = '<html><head>
            <meta property="og:title" content="Great Review" />
            <meta property="og:image" content="https://example.com/image.jpg" />
            <meta property="og:description" content="An amazing review." />
            <meta property="og:site_name" content="Music Blog" />
        </head><body></body></html>';

        Http::fake(['example.com/*' => Http::response($html, 200)]);

        $this->postJson('/api/press-releases/fetch-meta', ['url' => 'https://example.com/review'])
            ->assertSuccessful()
            ->assertJsonPath('data.og_title', 'Great Review')
            ->assertJsonPath('data.og_image', 'https://example.com/image.jpg')
            ->assertJsonPath('data.og_site_name', 'Music Blog');
    });

    it('returns 422 when the URL cannot be fetched', function () {
        $this->actingAsAdmin();

        Http::fake(['example.com/*' => Http::response('', 503)]);

        $this->postJson('/api/press-releases/fetch-meta', ['url' => 'https://example.com/broken'])
            ->assertStatus(422);
    });
});
