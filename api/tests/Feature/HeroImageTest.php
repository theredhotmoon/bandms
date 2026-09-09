<?php

use App\Models\HeroImage;
use App\Models\User;
use App\Models\WebsiteModule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(fn () => Storage::fake('public'));

function heroAdmin(): void
{
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
}

/** A hero_images row under the new standalone schema. */
function heroRow(array $overrides = []): HeroImage
{
    return HeroImage::create(array_merge([
        'scope'    => 'main',
        'image'    => 'hero-images/a.jpg',
        'caption'  => null,
        'position' => 0,
        'active'   => true,
    ], $overrides));
}

// ── schema / model ──────────────────────────────────────────────────────────────

it('orders a scope by position, not by id', function () {
    // position deliberately inverted against id: a read that leans on the
    // auto-increment tiebreaker instead of the column passes without this.
    $first  = heroRow(['image' => 'hero-images/first.jpg', 'position' => 1]);
    $second = heroRow(['image' => 'hero-images/second.jpg', 'position' => 0]);

    $ordered = HeroImage::where('scope', 'main')->orderBy('position')->pluck('id');

    expect($ordered->all())->toBe([$second->id, $first->id]);
});

it('defaults a new row to active', function () {
    $row = HeroImage::create([
        'scope'    => 'main',
        'image'    => 'hero-images/a.jpg',
        'position' => 0,
    ]);

    $row->refresh();

    expect($row->active)->toBeTrue();
});

it('treats every live module slug plus main and home as a valid scope', function () {
    $allowed = HeroImage::allowedScopes();

    expect($allowed)->toContain('main')
        ->and($allowed)->toContain('home')
        // Seeded by migrations — see the note in the original hero images test.
        ->and($allowed)->toContain('contact');
});

it('keeps a disabled module as a valid scope', function () {
    WebsiteModule::create(['slug' => 'photos', 'display_name' => 'Gallery', 'enabled' => false]);

    expect(HeroImage::allowedScopes())->toContain('photos');
});

// ── GET /admin/hero-images ──────────────────────────────────────────────────────

it('rejects hero image reads without auth', function () {
    $this->getJson('/api/admin/hero-images')->assertUnauthorized();
});

it('includes inactive rows for the admin, unlike the public payload', function () {
    heroAdmin();
    heroRow(['image' => 'hero-images/off.jpg', 'active' => false]);

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.active', false);
});

it('serves an empty admin payload as an object, not an array', function () {
    // The payload is a map keyed by scope. PHP's empty array encodes as [],
    // which contradicts the client's Record<string, HeroImage[]> type.
    heroAdmin();

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonPath('data', []);

    expect($this->getJson('/api/admin/hero-images')->content())
        ->toContain('"data":{}');
});

// ── POST /admin/hero-images/{scope} ─────────────────────────────────────────────

it('uploads one or more pictures into a scope', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', [
        'files'      => [$file],
        'captions'   => ['A caption'],
    ])
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.caption', 'A caption')
        ->assertJsonPath('data.main.0.active', true);

    $stored = HeroImage::first();
    Storage::disk('public')->assertExists($stored->image);
    expect($stored->image)->toStartWith('hero-images/');
});

it('appends uploads after the current max position', function () {
    heroAdmin();
    heroRow(['position' => 0]);
    $file = UploadedFile::fake()->create('b.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])
        ->assertOk()
        ->assertJsonPath('data.main.1.position', 1);
});

it('rejects an unknown scope on upload', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/not-a-page', ['files' => [$file]])
        ->assertStatus(422);
});

it('rejects a non-image upload', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('notes.txt', 10, 'text/plain');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])
        ->assertStatus(422);
});

it('rejects an unbounded files array', function () {
    heroAdmin();
    $files = array_map(fn () => UploadedFile::fake()->create('a.jpg', 10, 'image/jpeg'), range(1, 101));

    $this->postJson('/api/admin/hero-images/main', ['files' => $files])
        ->assertStatus(422);
});

it('asks the public site to rebuild after an upload, when auto-rebuild is on', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'true');
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
});

// ── PATCH /admin/hero-images/{heroImage} ────────────────────────────────────────

it('updates a caption alone', function () {
    heroAdmin();
    $row = heroRow(['caption' => 'old']);

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['caption' => 'new'])
        ->assertOk()
        ->assertJsonPath('data.main.0.caption', 'new')
        ->assertJsonPath('data.main.0.active', true);
});

it('toggles active alone', function () {
    heroAdmin();
    $row = heroRow(['active' => true]);

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['active' => false])
        ->assertOk()
        ->assertJsonPath('data.main.0.active', false)
        ->assertJsonPath('data.main.0.caption', null);
});

it('rejects an unknown hero image id on patch', function () {
    heroAdmin();

    $this->patchJson('/api/admin/hero-images/999999', ['active' => false])
        ->assertNotFound();
});

it('asks the public site to rebuild after a patch, when auto-rebuild is on', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'true');
    heroAdmin();
    $row = heroRow();

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['active' => false])->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
});

// ── PUT /admin/hero-images/{scope}/order ────────────────────────────────────────

it('writes position from the given order', function () {
    heroAdmin();
    $a = heroRow(['image' => 'hero-images/a.jpg', 'position' => 0]);
    $b = heroRow(['image' => 'hero-images/b.jpg', 'position' => 1]);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$b->id, $a->id]])
        ->assertOk()
        ->assertJsonPath('data.main.0.id', $b->id)
        ->assertJsonPath('data.main.0.position', 0)
        ->assertJsonPath('data.main.1.id', $a->id)
        ->assertJsonPath('data.main.1.position', 1);
});

it('rejects an id that belongs to a different scope', function () {
    heroAdmin();
    $other = heroRow(['scope' => 'contact']);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$other->id]])
        ->assertStatus(422);
});

it('rejects reordering into an unknown scope', function () {
    heroAdmin();
    $a = heroRow();

    $this->putJson('/api/admin/hero-images/not-a-page/order', ['order' => [$a->id]])
        ->assertStatus(422);
});
