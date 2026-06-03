<?php

use App\Models\MusicVideo;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => $this->createProfile());

// ── POST /api/music-videos/sync-views ────────────────────────────────────────

describe('POST /api/music-videos/sync-views', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/music-videos/sync-views')->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $this->actingAsUser();
        $this->postJson('/api/music-videos/sync-views')->assertForbidden();
    });

    it('returns 503 when the YouTube API key is not configured', function () {
        config(['services.youtube.api_key' => '']);
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos/sync-views')
            ->assertStatus(503)
            ->assertJsonPath('message', 'YouTube API key not configured. Set YOUTUBE_API_KEY in .env.');
    });

    it('returns a zero-updated response when no videos have YouTube URLs', function () {
        config(['services.youtube.api_key' => 'test-key']);
        $this->actingAsAdmin();

        MusicVideo::create([
            'profile_id' => 1,
            'title'      => 'Vimeo Video',
            'video_url'  => 'https://vimeo.com/123456789',
        ]);

        $this->postJson('/api/music-videos/sync-views')
            ->assertSuccessful()
            ->assertJsonPath('updated', 0)
            ->assertJsonPath('message', 'No YouTube videos found.');
    });

    it('syncs view counts for valid YouTube URLs', function () {
        config(['services.youtube.api_key' => 'test-key']);
        $this->actingAsAdmin();

        $video = MusicVideo::create([
            'profile_id' => 1,
            'title'      => 'My Video',
            'video_url'  => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'view_count' => 0,
        ]);

        Http::fake([
            'googleapis.com/*' => Http::response([
                'items' => [
                    ['id' => 'dQw4w9WgXcQ', 'statistics' => ['viewCount' => '999000']],
                ],
            ], 200),
        ]);

        $this->postJson('/api/music-videos/sync-views')
            ->assertSuccessful()
            ->assertJsonPath('message', 'Views synced successfully.')
            ->assertJsonPath('updated', 1)
            ->assertJsonPath('total_views', 999000);

        $this->assertDatabaseHas('music_videos', ['id' => $video->id, 'view_count' => 999000]);
    });

    it('handles youtube.com/shorts/ URLs', function () {
        config(['services.youtube.api_key' => 'test-key']);
        $this->actingAsAdmin();

        $video = MusicVideo::create([
            'profile_id' => 1,
            'title'      => 'Short',
            'video_url'  => 'https://www.youtube.com/shorts/abcdefghijk',
            'view_count' => 0,
        ]);

        Http::fake([
            'googleapis.com/*' => Http::response([
                'items' => [['id' => 'abcdefghijk', 'statistics' => ['viewCount' => '5000']]],
            ], 200),
        ]);

        $this->postJson('/api/music-videos/sync-views')
            ->assertSuccessful()
            ->assertJsonPath('updated', 1);

        $this->assertDatabaseHas('music_videos', ['id' => $video->id, 'view_count' => 5000]);
    });

    it('reports skipped count for videos without parseable YouTube IDs', function () {
        config(['services.youtube.api_key' => 'test-key']);
        $this->actingAsAdmin();

        MusicVideo::create(['profile_id' => 1, 'title' => 'YT', 'video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
        MusicVideo::create(['profile_id' => 1, 'title' => 'Skip', 'video_url' => 'https://vimeo.com/12345']);

        Http::fake([
            'googleapis.com/*' => Http::response([
                'items' => [['id' => 'dQw4w9WgXcQ', 'statistics' => ['viewCount' => '100']]],
            ], 200),
        ]);

        $this->postJson('/api/music-videos/sync-views')
            ->assertSuccessful()
            ->assertJsonPath('updated', 1)
            ->assertJsonPath('skipped', 1);
    });

    it('returns 502 when the YouTube API request fails', function () {
        config(['services.youtube.api_key' => 'test-key']);
        $this->actingAsAdmin();

        MusicVideo::create([
            'profile_id' => 1,
            'title'      => 'Video',
            'video_url'  => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ]);

        Http::fake(['googleapis.com/*' => Http::response([], 403)]);

        $this->postJson('/api/music-videos/sync-views')->assertStatus(502);
    });
});
