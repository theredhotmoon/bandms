<?php

use App\Models\Post;
use App\Models\Tag;

/**
 * The News page's top post is either the one the band highlighted in the
 * admin's posts list or, with none, the newest. It is decided once per build
 * (GET /api/posts/featured) and stays put whatever a visitor filters, and the
 * grid below it never repeats it — the public site passes its id as
 * `exclude`.
 *
 * "Show more" fetches the grid in batches of `limit` with a cursor (the last
 * post shown) instead of a page number, so a post published after the build
 * cannot shift a batch into a repeat or a skip.
 */

describe('PUT /api/posts/{post}/highlight', function () {
    it('requires authentication', function () {
        $post = Post::factory()->published()->create();

        $this->putJson("/api/posts/{$post->id}/highlight", ['highlighted' => true])->assertUnauthorized();
    });

    it('is closed to members', function () {
        $this->actingAsMember();
        $post = Post::factory()->published()->create();

        $this->putJson("/api/posts/{$post->id}/highlight", ['highlighted' => true])->assertForbidden();
    });

    it('pins one post at a time', function () {
        $this->actingAsAdmin();
        [$a, $b] = Post::factory()->published()->count(2)->create();

        $this->putJson("/api/posts/{$a->id}/highlight", ['highlighted' => true])
            ->assertSuccessful()
            ->assertJsonPath('data.is_highlighted', true);
        $this->putJson("/api/posts/{$b->id}/highlight", ['highlighted' => true])->assertSuccessful();

        expect($a->fresh()->is_highlighted)->toBeFalse()
            ->and($b->fresh()->is_highlighted)->toBeTrue();
    });

    it('keeps a post pinned when it is pinned again', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->published()->create(['is_highlighted' => true]);

        $this->putJson("/api/posts/{$post->id}/highlight", ['highlighted' => true])->assertSuccessful();

        expect($post->fresh()->is_highlighted)->toBeTrue();
    });

    it('unpins', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->published()->create(['is_highlighted' => true]);

        $this->putJson("/api/posts/{$post->id}/highlight", ['highlighted' => false])->assertSuccessful();

        expect($post->fresh()->is_highlighted)->toBeFalse();
    });

    it('refuses a draft, and leaves the current pin alone', function () {
        $this->actingAsAdmin();
        $pinned = Post::factory()->published()->create(['is_highlighted' => true]);
        $draft  = Post::factory()->draft()->create();

        $this->putJson("/api/posts/{$draft->id}/highlight", ['highlighted' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('highlighted');

        expect($pinned->fresh()->is_highlighted)->toBeTrue();
    });

    it('requires the flag', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->published()->create();

        $this->putJson("/api/posts/{$post->id}/highlight", [])->assertUnprocessable();
    });

    it('is shown on the admin list', function () {
        $this->actingAsAdmin();
        Post::factory()->published()->create(['is_highlighted' => true]);

        $this->getJson('/api/admin/posts')->assertJsonPath('data.0.is_highlighted', true);
    });

    it('is given up when the post is unpublished', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->published()->create(['is_highlighted' => true]);

        $this->putJson("/api/posts/{$post->id}", ['published_at' => null])->assertSuccessful();

        expect($post->fresh()->is_highlighted)->toBeFalse();
    });
});

describe('GET /api/posts/featured', function () {
    it('serves the highlighted post, however old', function () {
        $old = Post::factory()->published()->create(['published_at' => now()->subYear(), 'is_highlighted' => true]);
        Post::factory()->published()->create(['published_at' => now()]);

        $this->getJson('/api/posts/featured')
            ->assertSuccessful()
            ->assertJsonPath('data.id', $old->id)
            ->assertJsonPath('data.is_highlighted', true);
    });

    it('falls back to the newest post when none is highlighted', function () {
        Post::factory()->published()->create(['published_at' => now()->subDay()]);
        $new = Post::factory()->published()->create(['published_at' => now()]);

        $this->getJson('/api/posts/featured')->assertJsonPath('data.id', $new->id);
    });

    it('never serves a draft', function () {
        Post::factory()->draft()->create(['is_highlighted' => true]);
        $live = Post::factory()->published()->create();

        $this->getJson('/api/posts/featured')->assertJsonPath('data.id', $live->id);
    });

    it('is not narrowed by list filters in the query string', function () {
        $pinned = Post::factory()->published()->create(['title' => ['en' => 'Pinned'], 'is_highlighted' => true]);
        Post::factory()->published()->create(['title' => ['en' => 'Other']]);

        $this->getJson('/api/posts/featured?search=Other')->assertJsonPath('data.id', $pinned->id);
    });

    it('serves null when nothing is published', function () {
        $this->getJson('/api/posts/featured')->assertSuccessful()->assertJsonPath('data', null);
    });
});

describe('GET /api/posts?limit= (Show more)', function () {
    it('walks every post exactly once, newest first, without the excluded one', function () {
        $posts = collect(range(1, 7))->map(fn ($i) => Post::factory()->published()->create([
            'published_at' => now()->subDays($i),
        ]));
        $top = $posts->first();

        $seen = [];
        $url  = "/api/posts?limit=3&exclude={$top->id}";
        while ($url) {
            $res    = $this->getJson($url)->assertSuccessful();
            $seen   = [...$seen, ...array_column($res->json('data'), 'id')];
            $cursor = $res->json('meta.next_cursor');
            $url    = $cursor ? "/api/posts?limit=3&exclude={$top->id}&cursor={$cursor}" : null;
        }

        expect($seen)->toBe($posts->skip(1)->pluck('id')->all());
    });

    // The reason for a cursor over a page number: the site was built before
    // this post existed, so its first batch is the old first six.
    it('does not repeat a post when a newer one is published between batches', function () {
        collect(range(1, 4))->each(fn ($i) => Post::factory()->published()->create(['published_at' => now()->subDays($i)]));

        $first  = $this->getJson('/api/posts?limit=2')->json();
        Post::factory()->published()->create(['published_at' => now()]);
        $second = $this->getJson('/api/posts?limit=2&cursor=' . $first['meta']['next_cursor'])->json();

        expect(array_intersect(array_column($first['data'], 'id'), array_column($second['data'], 'id')))->toBeEmpty()
            ->and($second['data'])->toHaveCount(2);
    });

    it('filters by tag and search', function () {
        $tag = Tag::factory()->create();
        $tagged = Post::factory()->published()->create(['title' => 'Tour diary']);
        $tagged->tags()->attach($tag);
        Post::factory()->published()->create(['title' => 'Something else']);
        Post::factory()->published()->create(['title' => 'Plain', 'intro' => 'A word about the tour bus']);

        $this->getJson("/api/posts?limit=6&tag_id={$tag->id}")->assertJsonCount(1, 'data');
        // Intro counts: the browser-side search matched it, so the server does.
        $this->getJson('/api/posts?limit=6&search=tour')->assertJsonCount(2, 'data');
    });

    it('omits drafts', function () {
        Post::factory()->published()->create();
        Post::factory()->draft()->create();

        $this->getJson('/api/posts?limit=6')->assertJsonCount(1, 'data');
    });

    // MySQL compares JSON as utf8mb4_bin, so these held only on SQLite until
    // the search lowercased explicitly and read one locale's value at a time.
    it('searches ignoring case, and never matches the JSON keys', function () {
        Post::factory()->published()->create(['title' => ['en' => 'Summer Tour'], 'intro' => ['en' => 'x']]);

        Post::factory()->published()->create(['title' => ['en' => 'Other'], 'intro' => ['en' => 'x']])
            ->blocks()->create(['type' => 'text', 'position' => 0, 'payload' => ['body' => ['en' => '<p>Hi</p>']]]);

        $this->getJson('/api/posts?limit=6&lang=en&search=summer tour')->assertJsonCount(1, 'data');
        $this->getJson('/api/posts?limit=6&lang=en&search=hi')->assertJsonCount(1, 'data');
        // "en" and "body" are keys of the JSON, not text anyone wrote.
        $this->getJson('/api/posts?limit=6&lang=en&search=en')->assertJsonCount(0, 'data');
        $this->getJson('/api/posts?limit=6&lang=en&search=body')->assertJsonCount(0, 'data');
    });

    it('treats % and _ in a search as literal characters', function () {
        Post::factory()->published()->create(['title' => ['en' => 'Plain'], 'intro' => ['en' => 'x']]);

        $this->getJson('/api/posts?limit=6&lang=en&search=%25')->assertJsonCount(0, 'data');
        $this->getJson('/api/posts?limit=6&lang=en&search=_')->assertJsonCount(0, 'data');
    });

    // A post with no article page yet would be a card that 404s.
    it('leaves out posts created or published after the site was built', function () {
        $built = now()->subHour();
        $old   = Post::factory()->published()->create(['published_at' => now()->subDays(2), 'created_at' => now()->subDays(2)]);
        Post::factory()->published()->create(['published_at' => now(), 'created_at' => now()]);
        Post::factory()->published()->create(['published_at' => now()->subDays(3), 'created_at' => now()]);

        $this->getJson('/api/posts?limit=6&built_at=' . urlencode($built->toIso8601String()))
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $old->id);
    });

    // published_at is a switch, not a timer: a future date was published
    // before the build, so its page exists and it must stay in the list.
    it('keeps a post dated in the future that existed at build time', function () {
        $future = Post::factory()->published()->create(['published_at' => now()->addWeek(), 'created_at' => now()->subDays(2)]);

        $this->getJson('/api/posts?limit=6&built_at=' . urlencode(now()->subHour()->toIso8601String()))
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $future->id);
    });

    it('finds a post by an embed URL', function () {
        Post::factory()->published()->create(['title' => ['en' => 'Video'], 'intro' => ['en' => 'x']])
            ->blocks()->create(['type' => 'embed', 'position' => 0, 'payload' => ['url' => 'https://www.youtube.com/watch?v=abc123']]);

        $this->getJson('/api/posts?limit=6&lang=en&search=ABC123')->assertJsonCount(1, 'data');
    });

    it('rejects a limit out of range', function () {
        $this->getJson('/api/posts?limit=500')->assertUnprocessable();
        $this->getJson('/api/posts?limit=0')->assertUnprocessable();
    });
});
