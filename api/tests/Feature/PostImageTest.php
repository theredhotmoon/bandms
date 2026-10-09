<?php

use App\Models\Post;
use App\Models\User;
use App\Support\PostImageFileBackfill;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

/**
 * A post's main image is a file on the public disk under `post-images/`,
 * uploaded ahead of the post the way block images are, and served as
 * `/storage/<path>` by both post resources. It used to be a base64 data URL
 * in the `image` column, which every list response and the news page's
 * island props then carried in full.
 */

// 1×1 transparent PNG, the admin's old upload shape.
const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

beforeEach(function () {
    Storage::fake('public');
    Http::fake();
});

function storedPostImage(string $name = 'cover.jpg'): string
{
    return UploadedFile::fake()->image($name)->store('post-images', 'public');
}

describe('POST /api/posts/image', function () {
    it('rejects an anonymous upload', function () {
        $this->postJson('/api/posts/image', ['image' => UploadedFile::fake()->image('x.jpg')])
            ->assertUnauthorized();
    });

    it('stores the file under post-images and returns its path and url', function () {
        Passport::actingAs(User::factory()->create(['role' => 'admin']));

        $res = $this->postJson('/api/posts/image', ['image' => UploadedFile::fake()->image('cover.jpg')])
            ->assertCreated();

        $path = $res->json('path');
        expect($path)->toStartWith('post-images/');
        expect($res->json('url'))->toBe('/storage/' . $path);
        Storage::disk('public')->assertExists($path);
    });

    it('rejects a non-image and an oversized file', function () {
        Passport::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/posts/image', ['image' => UploadedFile::fake()->create('doc.pdf', 10)])
            ->assertStatus(422);
        $this->postJson('/api/posts/image', ['image' => UploadedFile::fake()->image('big.jpg')->size(5000)])
            ->assertStatus(422);
    });
});

describe('image on a post', function () {
    beforeEach(fn () => Passport::actingAs(User::factory()->create(['role' => 'admin'])));

    it('accepts an uploaded path on create and serves it as a /storage url', function () {
        $path = storedPostImage();

        $res = $this->postJson('/api/posts', ['title' => ['en' => 'With cover'], 'image' => $path])
            ->assertCreated()
            ->assertJsonPath('data.image', '/storage/' . $path);

        expect(Post::find($res->json('data.id'))->image)->toBe($path);
    });

    it('serves the /storage url in the public list too', function () {
        $path = storedPostImage();
        Post::factory()->create(['image' => $path]);

        $this->getJson('/api/posts')
            ->assertSuccessful()
            ->assertJsonPath('data.0.image', '/storage/' . $path);
    });

    it('serves null when there is no image', function () {
        $post = Post::factory()->create(['image' => null]);

        $this->getJson("/api/posts/{$post->id}")->assertJsonPath('data.image', null);
    });

    it('rejects a data url and a path outside post-images', function () {
        $this->postJson('/api/posts', ['title' => ['en' => 'X'], 'image' => DATA_URL])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');

        $this->postJson('/api/posts', ['title' => ['en' => 'X'], 'image' => 'release-covers/stolen.jpg'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');

        $this->postJson('/api/posts', ['title' => ['en' => 'X'], 'image' => 'post-images/../.env'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');
    });

    it('deletes the old file when an update replaces the image', function () {
        $old = storedPostImage('old.jpg');
        $new = storedPostImage('new.jpg');
        $post = Post::factory()->create(['image' => $old]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'X'], 'image' => $new])
            ->assertSuccessful()
            ->assertJsonPath('data.image', '/storage/' . $new);

        Storage::disk('public')->assertMissing($old);
        Storage::disk('public')->assertExists($new);
    });

    it('deletes the file when an update clears the image', function () {
        $old = storedPostImage();
        $post = Post::factory()->create(['image' => $old]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'X'], 'image' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.image', null);

        Storage::disk('public')->assertMissing($old);
        expect($post->fresh()->image)->toBeNull();
    });

    it('keeps the file and the path when an update does not mention the image', function () {
        $old = storedPostImage();
        $post = Post::factory()->create(['image' => $old]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])
            ->assertSuccessful()
            ->assertJsonPath('data.image', '/storage/' . $old);

        Storage::disk('public')->assertExists($old);
    });

    it('keeps the file when an update resends the same path', function () {
        $old = storedPostImage();
        $post = Post::factory()->create(['image' => $old]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'X'], 'image' => $old])
            ->assertSuccessful();

        Storage::disk('public')->assertExists($old);
    });

    it('deletes the file when the post is deleted', function () {
        $old = storedPostImage();
        $post = Post::factory()->create(['image' => $old]);

        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

        Storage::disk('public')->assertMissing($old);
    });
});

describe('PostImageFileBackfill', function () {
    it('writes each base64 image to a file and stores its path', function () {
        $post = Post::factory()->create(['image' => DATA_URL]);
        $untouched = Post::factory()->create(['image' => null]);

        $changed = PostImageFileBackfill::run();

        expect($changed)->toBe(1);
        $path = $post->fresh()->image;
        expect($path)->toMatch('#^post-images/[A-Za-z0-9]+\.png$#');
        Storage::disk('public')->assertExists($path);
        expect(Storage::disk('public')->get($path))
            ->toBe(base64_decode(substr(DATA_URL, strpos(DATA_URL, ',') + 1)));
        expect($untouched->fresh()->image)->toBeNull();
    });

    it('leaves a path that is already a file alone', function () {
        $path = storedPostImage();
        $post = Post::factory()->create(['image' => $path]);

        expect(PostImageFileBackfill::run())->toBe(0);
        expect($post->fresh()->image)->toBe($path);
    });

    it('clears a value that is not a decodable image rather than keep serving it', function () {
        $post = Post::factory()->create(['image' => 'data:image/png;base64,***not-base64***']);

        PostImageFileBackfill::run();

        expect($post->fresh()->image)->toBeNull();
    });

    it('picks the extension from the mime type', function () {
        $jpeg = Post::factory()->create(['image' => 'data:image/jpeg;base64,' . base64_encode('jpeg-bytes')]);
        $webp = Post::factory()->create(['image' => 'data:image/webp;base64,' . base64_encode('webp-bytes')]);

        PostImageFileBackfill::run();

        expect($jpeg->fresh()->image)->toEndWith('.jpg');
        expect($webp->fresh()->image)->toEndWith('.webp');
    });
});
