<?php

use App\Models\BandMember;
use App\Models\Clip;
use App\Models\Post;
use App\Models\ShopItem;
use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Laravel\Passport\Passport;

/*
 * Music videos and clips are one library. A video is `official` (the band
 * made it) or `fan` (someone else filmed it; the public site credits their
 * channel). These cover the new fields, the endpoints that moved over from
 * /api/music-videos, and the migration that folded the old table in.
 */

describe('official and fan videos', function () {
    it('defaults a new video to official', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
            ->assertCreated()
            ->assertJsonPath('data.source', 'official');
    });

    it('stores a fan video with its channel credit and serves it publicly', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', [
            'url'          => 'https://www.youtube.com/watch?v=qyRvEO_o6z0',
            'source'       => 'fan',
            'channel_name' => 'Gig Goer',
            'channel_url'  => 'https://www.youtube.com/@giggoer',
        ])->assertCreated();

        $this->getJson('/api/clips')
            ->assertJsonPath('data.0.source', 'fan')
            ->assertJsonPath('data.0.channel_name', 'Gig Goer')
            ->assertJsonPath('data.0.channel_url', 'https://www.youtube.com/@giggoer');
    });

    it('rejects an unknown source and a channel link that is not a URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', [
            'url'         => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'source'      => 'press',
            'channel_url' => 'not a url',
        ])->assertUnprocessable()->assertJsonValidationErrors(['source', 'channel_url']);
    });

    it('switches a video between official and fan without touching anything else', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create(['category' => 'music_video', 'view_count' => 500]);

        $this->putJson("/api/clips/{$clip->id}", ['source' => 'fan'])->assertOk()
            ->assertJsonPath('data.source', 'fan')
            ->assertJsonPath('data.category', 'music_video')
            ->assertJsonPath('data.view_count', 500);

        // An explicit null falls back to official — the column is NOT NULL.
        $this->putJson("/api/clips/{$clip->id}", ['source' => null])->assertOk()
            ->assertJsonPath('data.source', 'official');
    });

    it('stamps the sync time with a count the form sends, and clears both together', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create(['view_count' => 10, 'views_synced_at' => now()->subYear()]);

        $this->putJson("/api/clips/{$clip->id}", ['view_count' => 900])->assertOk();
        expect($clip->fresh()->views_synced_at->isToday())->toBeTrue();

        // A new URL without a Retrieve sends null: no count, no sync time.
        $this->putJson("/api/clips/{$clip->id}", ['url' => 'https://vimeo.com/76979871', 'view_count' => null])->assertOk();
        expect($clip->fresh()->views_synced_at)->toBeNull();

        // A save that does not mention the count leaves both alone.
        $clip->update(['view_count' => 5, 'views_synced_at' => now()->subDay()]);
        $this->putJson("/api/clips/{$clip->id}", ['category' => 'studio'])->assertOk();
        expect($clip->fresh()->views_synced_at->isYesterday())->toBeTrue();
    });

    it('carries the fan credit into a news ref block and the EPK', function () {
        $clip = Clip::factory()->fan()->create(['show_in_epk' => true]);
        $post = Post::factory()->create();
        $post->blocks()->create(['position' => 0, 'type' => 'ref', 'payload' => ['entity' => 'clip', 'id' => $clip->id]]);

        $this->getJson("/api/posts/{$post->id}")
            ->assertJsonPath('data.blocks.0.data.source', 'fan')
            ->assertJsonPath('data.blocks.0.data.channel_name', 'Gig Goer');

        $this->createProfile();
        $epk = \App\Services\EpkSnapshotBuilder::build();
        expect($epk['clips'][0])->toMatchArray(['source' => 'fan', 'channel_url' => 'https://www.youtube.com/@giggoer']);
    });

    it('rebuilds the Videos page on any change and the Music page for a music video', function () {
        $this->actingAsAdmin();
        SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

        $this->postJson('/api/clips', ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'category' => 'backstage'])->assertCreated();
        expect(SiteDirtyArea::pluck('area')->all())->toContain('music-videos')->not->toContain('releases');

        $this->postJson('/api/clips', ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'category' => 'music_video'])->assertCreated();
        expect(SiteDirtyArea::pluck('area')->all())->toContain('releases');
    });

    it('rebuilds the Music page when a video stops being a music video', function () {
        $this->actingAsAdmin();
        SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
        $clip = Clip::factory()->create(['category' => 'music_video']);
        SiteDirtyArea::query()->delete();

        $this->putJson("/api/clips/{$clip->id}", ['category' => 'live'])->assertOk();

        expect(SiteDirtyArea::where('area', 'releases')->exists())->toBeTrue();
    });
});

describe('POST /api/clips/retrieve-metadata', function () {
    it('requires an admin', function () {
        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://youtu.be/dQw4w9WgXcQ'])->assertUnauthorized();

        Passport::actingAs(User::factory()->create(['role' => 'member']));
        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://youtu.be/dQw4w9WgXcQ'])->assertForbidden();
    });

    it('returns the channel name and link from oEmbed', function () {
        $this->actingAsAdmin();
        config(['services.youtube.api_key' => null]);
        Http::fake(['www.youtube.com/oembed*' => Http::response([
            'title'         => 'Live at Klub Studio',
            'thumbnail_url' => 'https://i.ytimg.com/vi/qyRvEO_o6z0/hqdefault.jpg',
            'author_name'   => 'Gig Goer',
            'author_url'    => 'https://www.youtube.com/@giggoer',
            'provider_name' => 'YouTube',
        ])]);

        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://www.youtube.com/watch?v=qyRvEO_o6z0'])
            ->assertOk()
            ->assertJson([
                'title'        => 'Live at Klub Studio',
                'channel_name' => 'Gig Goer',
                'channel_url'  => 'https://www.youtube.com/@giggoer',
                'view_count'   => null,
            ]);
    });

    it('adds views and duration when a YouTube key is set, sending the key in a header', function () {
        $this->actingAsAdmin();
        config(['services.youtube.api_key' => 'secret-key']);
        Http::fake([
            'www.youtube.com/oembed*'        => Http::response(['title' => 'T', 'author_name' => 'C']),
            'www.googleapis.com/youtube/v3/*' => Http::response(['items' => [[
                'statistics'     => ['viewCount' => '12345'],
                'contentDetails' => ['duration' => 'PT1H4M33S'],
            ]]]),
        ]);

        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://youtu.be/dQw4w9WgXcQ'])
            ->assertOk()
            ->assertJson(['view_count' => 12345, 'duration' => '1:04:33']);

        Http::assertSent(fn ($r) => str_contains($r->url(), 'googleapis.com')
            && $r->hasHeader('X-Goog-Api-Key', 'secret-key')
            && ! str_contains($r->url(), 'secret-key'));
    });

    it('keeps a TikTok channel but not its expiring thumbnail', function () {
        $this->actingAsAdmin();
        Http::fake(['www.tiktok.com/oembed*' => Http::response([
            'title' => 'Front row', 'author_name' => 'giggoer', 'author_url' => 'https://www.tiktok.com/@giggoer',
            'thumbnail_url' => 'https://p16-sign.tiktokcdn-us.com/x.jpeg?x-expires=1700000000&x-signature=abc',
        ])]);

        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://www.tiktok.com/@giggoer/video/7300000000000000000'])
            ->assertOk()
            ->assertJson(['channel_name' => 'giggoer', 'channel_url' => 'https://www.tiktok.com/@giggoer', 'thumbnail_url' => null]);
    });

    it('refuses a provider without a keyless oEmbed', function () {
        $this->actingAsAdmin();
        Http::fake();

        $this->postJson('/api/clips/retrieve-metadata', ['url' => 'https://www.instagram.com/p/abc123/'])
            ->assertUnprocessable();
        Http::assertNothingSent();
    });
});

describe('POST /api/clips/sync-views', function () {
    it('requires an admin', function () {
        $this->postJson('/api/clips/sync-views')->assertUnauthorized();
    });

    it('returns 503 without a YouTube key', function () {
        $this->actingAsAdmin();
        config(['services.youtube.api_key' => null]);

        $this->postJson('/api/clips/sync-views')->assertStatus(503);
    });

    it('updates every YouTube video, fan ones included, and skips other providers', function () {
        $this->actingAsAdmin();
        config(['services.youtube.api_key' => 'k']);
        $official = Clip::factory()->create(['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
        $fan      = Clip::factory()->fan()->create(['url' => 'https://youtu.be/qyRvEO_o6z0']);
        $vimeo    = Clip::factory()->create(['provider' => 'vimeo', 'url' => 'https://vimeo.com/76979871']);
        Http::fake(['www.googleapis.com/*' => Http::response(['items' => [
            ['id' => 'dQw4w9WgXcQ', 'statistics' => ['viewCount' => '1000']],
            ['id' => 'qyRvEO_o6z0', 'statistics' => ['viewCount' => '250']],
        ]])]);

        $this->postJson('/api/clips/sync-views')->assertOk()
            ->assertJson(['updated' => 2, 'total_views' => 1250]);

        expect($official->fresh()->view_count)->toBe(1000)
            ->and($fan->fresh()->view_count)->toBe(250)
            ->and($fan->fresh()->views_synced_at)->not->toBeNull()
            ->and($vimeo->fresh()->view_count)->toBeNull();
    });

    it('reports a failed YouTube call as 502', function () {
        $this->actingAsAdmin();
        config(['services.youtube.api_key' => 'k']);
        Clip::factory()->create();
        Http::fake(['www.googleapis.com/*' => Http::response([], 500)]);

        $this->postJson('/api/clips/sync-views')->assertStatus(502);
    });
});

describe('merging music videos into clips (migration)', function () {
    /** Recreate the legacy tables as they stood, then re-run the merge. */
    function legacyVideoTables(): void
    {
        Schema::create('music_videos', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('profile_id');
            $t->string('title');
            $t->string('video_url', 500);
            $t->date('published_at')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->string('og_title', 500)->nullable();
            $t->string('og_image', 1000)->nullable();
            $t->string('og_site_name')->nullable();
            $t->string('channel_name')->nullable();
            $t->string('duration', 20)->nullable();
            $t->unsignedBigInteger('view_count')->nullable();
            $t->timestamp('views_synced_at')->nullable();
            $t->timestamps();
        });
        Schema::create('shop_item_video', function (Blueprint $t) {
            $t->unsignedBigInteger('shop_item_id');
            $t->unsignedBigInteger('music_video_id');
        });
    }

    function runMerge(): void
    {
        (require database_path('migrations/2026_11_16_000001_merge_music_videos_into_clips.php'))->up();
    }

    it('turns each music video into an official music_video clip and repoints every link', function () {
        // A clip already exists, so clip ids and music-video ids overlap.
        $existing = Clip::factory()->create();
        legacyVideoTables();

        DB::table('music_videos')->insert([
            'id' => $existing->id, 'profile_id' => 1, 'title' => 'Band title', 'og_title' => 'YouTube title',
            'video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'published_at' => '2025-05-01',
            'og_image' => 'https://i.ytimg.com/x.jpg', 'channel_name' => 'Skanking Storks',
            'duration' => '3:45', 'view_count' => 4200, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->createProfile();
        $member = BandMember::factory()->create();
        DB::table('memberables')->insert(['band_member_id' => $member->id, 'memberable_type' => 'music_video', 'memberable_id' => $existing->id]);

        $item = ShopItem::factory()->create();
        DB::table('shop_item_video')->insert(['shop_item_id' => $item->id, 'music_video_id' => $existing->id]);

        $post = Post::factory()->create();
        DB::table('post_blocks')->insert([
            'post_id' => $post->id, 'position' => 0, 'type' => 'ref',
            'payload' => json_encode(['entity' => 'music_video', 'id' => $existing->id, 'note' => 'kept']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        runMerge();

        $clip = Clip::where('category', 'music_video')->sole();
        expect($clip->id)->not->toBe($existing->id)
            ->and($clip->source)->toBe('official')
            ->and($clip->getTranslation('title', 'en'))->toBe('YouTube title')
            ->and($clip->recorded_on->format('Y-m-d'))->toBe('2025-05-01')
            ->and($clip->provider)->toBe('youtube')
            ->and($clip->thumbnail_url)->toBe('https://i.ytimg.com/x.jpg')
            ->and($clip->channel_name)->toBe('Skanking Storks')
            ->and($clip->view_count)->toBe(4200)
            ->and($clip->show_in_epk)->toBeFalse();

        expect($clip->members()->pluck('band_members.id')->all())->toBe([$member->id]);
        expect($item->clips()->pluck('clips.id')->all())->toBe([$clip->id]);

        $payload = json_decode(DB::table('post_blocks')->where('post_id', $post->id)->value('payload'), true);
        expect($payload)->toBe(['entity' => 'clip', 'id' => $clip->id, 'note' => 'kept']);

        expect(Schema::hasTable('music_videos'))->toBeFalse()
            ->and(Schema::hasTable('shop_item_video'))->toBeFalse();
    });

    it('falls back to the band title and drops a ref to a video already deleted', function () {
        legacyVideoTables();
        DB::table('music_videos')->insert([
            'id' => 7, 'profile_id' => 1, 'title' => 'Only ours', 'og_title' => null,
            'video_url' => 'https://vimeo.com/76979871', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $post = Post::factory()->create();
        DB::table('post_blocks')->insert([
            'post_id' => $post->id, 'position' => 0, 'type' => 'ref',
            'payload' => json_encode(['entity' => 'music_video', 'id' => 999]),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        runMerge();

        $clip = Clip::sole();
        expect($clip->getTranslation('title', 'en'))->toBe('Only ours')
            ->and($clip->provider)->toBe('vimeo')
            ->and($clip->recorded_on)->toBeNull();
        expect(DB::table('post_blocks')->where('post_id', $post->id)->exists())->toBeFalse();
    });
});
