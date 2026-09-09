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
