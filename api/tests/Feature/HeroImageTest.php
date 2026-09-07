<?php

use App\Models\HeroImage;
use App\Models\Photo;
use App\Models\WebsiteModule;

function heroPhoto(string $image = 'photos/a.jpg'): Photo
{
    return Photo::create(['image' => $image, 'sort_order' => 0]);
}

it('orders a scope by position, not by id', function () {
    $first  = heroPhoto('photos/first.jpg');
    $second = heroPhoto('photos/second.jpg');

    // position deliberately inverted against id: a read that leans on the
    // auto-increment tiebreaker instead of the column passes without this.
    HeroImage::create(['photo_id' => $first->id,  'scope' => 'main', 'position' => 1]);
    HeroImage::create(['photo_id' => $second->id, 'scope' => 'main', 'position' => 0]);

    $ordered = HeroImage::where('scope', 'main')->orderBy('position')->pluck('photo_id');

    expect($ordered->all())->toBe([$second->id, $first->id]);
});

it('drops out of every scope when its photo is deleted', function () {
    $photo = heroPhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main',    'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'contact', 'position' => 0]);

    $photo->delete();

    expect(HeroImage::count())->toBe(0);
});

it('allows the same photo in several scopes', function () {
    $photo = heroPhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main', 'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'home', 'position' => 0]);

    expect(HeroImage::where('photo_id', $photo->id)->count())->toBe(2);
});

it('treats every live module slug plus main and home as a valid scope', function () {
    $allowed = HeroImage::allowedScopes();

    expect($allowed)->toContain('main')
        ->and($allowed)->toContain('home')
        ->and($allowed)->toContain('contact');
});

it('keeps a disabled module as a valid scope', function () {
    // Switching a section off must not make its pictures unsavable — the same
    // rule FAQ categories follow.
    //
    // The module is created here rather than disabling a seeded one: migrations
    // only insert contact, about and footer, and the rest arrive via a seeder
    // that does not run against the test database.
    WebsiteModule::create([
        'slug'         => 'photos',
        'display_name' => 'Gallery',
        'enabled'      => false,
    ]);

    expect(HeroImage::allowedScopes())->toContain('photos');
});
