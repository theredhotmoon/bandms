<?php

use App\Models\MusicVideo;
use App\Models\User;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/music-videos ─────────────────────────────────────────────────────

describe('GET /api/music-videos', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/music-videos')->assertSuccessful();
    });

    it('returns videos ordered by sort_order', function () {
        MusicVideo::create(['profile_id' => 1, 'title' => 'Second', 'video_url' => 'https://youtube.com/b', 'sort_order' => 1]);
        MusicVideo::create(['profile_id' => 1, 'title' => 'First',  'video_url' => 'https://youtube.com/a', 'sort_order' => 0]);

        $this->getJson('/api/music-videos')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'First');
    });
});

// ── POST /api/music-videos ────────────────────────────────────────────────────

describe('POST /api/music-videos', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/music-videos', ['title' => 'Test', 'video_url' => 'https://youtube.com/x'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/music-videos', ['title' => 'Test', 'video_url' => 'https://youtube.com/x'])->assertForbidden();
    });

    it('creates a music video', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos', [
            'title'     => 'My Video',
            'video_url' => 'https://youtube.com/watch?v=abc123',
        ])->assertCreated()
          ->assertJsonPath('data.title', 'My Video')
          ->assertJsonPath('data.video_url', 'https://youtube.com/watch?v=abc123');

        $this->assertDatabaseHas('music_videos', ['title' => 'My Video']);
    });

    it('validates title is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos', ['video_url' => 'https://youtube.com/x'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    });

    it('validates video_url is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos', ['title' => 'Test'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['video_url']);
    });

    it('validates video_url must be a valid URL', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos', ['title' => 'Test', 'video_url' => 'not-a-url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['video_url']);
    });

    it('validates published_at must be Y-m-d format', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/music-videos', [
            'title'        => 'Test',
            'video_url'    => 'https://youtube.com/x',
            'published_at' => '01/06/2025',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['published_at']);
    });
});

// ── PUT /api/music-videos/{musicVideo} ────────────────────────────────────────

describe('PUT /api/music-videos/{musicVideo}', function () {
    it('returns 401 without authentication', function () {
        $video = MusicVideo::create(['profile_id' => 1, 'title' => 'V', 'video_url' => 'https://youtube.com/x']);

        $this->putJson("/api/music-videos/{$video->id}", ['title' => 'New'])->assertUnauthorized();
    });

    it('updates a music video', function () {
        $this->actingAsAdmin();
        $video = MusicVideo::create(['profile_id' => 1, 'title' => 'Old Title', 'video_url' => 'https://youtube.com/x']);

        $this->putJson("/api/music-videos/{$video->id}", ['title' => 'New Title'])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'New Title');
    });

    it('returns 404 for a non-existent video', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/music-videos/9999', ['title' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/music-videos/{musicVideo} ─────────────────────────────────────

describe('DELETE /api/music-videos/{musicVideo}', function () {
    it('returns 401 without authentication', function () {
        $video = MusicVideo::create(['profile_id' => 1, 'title' => 'V', 'video_url' => 'https://youtube.com/x']);

        $this->deleteJson("/api/music-videos/{$video->id}")->assertUnauthorized();
    });

    it('deletes a music video', function () {
        $this->actingAsAdmin();
        $video = MusicVideo::create(['profile_id' => 1, 'title' => 'Gone', 'video_url' => 'https://youtube.com/x']);

        $this->deleteJson("/api/music-videos/{$video->id}")->assertNoContent();

        $this->assertDatabaseMissing('music_videos', ['id' => $video->id]);
    });

    it('returns 404 for a non-existent video', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/music-videos/9999')->assertNotFound();
    });
});
