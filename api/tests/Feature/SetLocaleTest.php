<?php

use App\Models\Concert;
use App\Models\User;
use App\Models\Venue;
use Laravel\Passport\Passport;

/*
 * Two languages can arrive on one admin request, and they mean different things.
 *
 * `X-Content-Locale` is the band's content language: which translation of a
 * concert's name the response resolves. `Accept-Language` is the person's:
 * which language a validation message is written in. The admin panel sends
 * both, and an editor with an English UI on a Polish-first band must get a
 * Polish concert name and an English error.
 */

it('resolves content in the X-Content-Locale language', function () {
    Concert::factory()->create(['name' => ['en' => 'Anniversary', 'pl' => 'Rocznica']]);

    $this->getJson('/api/concerts', ['X-Content-Locale' => 'pl', 'Accept-Language' => 'en'])
        ->assertJsonPath('data.0.name', 'Rocznica');

    $this->getJson('/api/concerts', ['X-Content-Locale' => 'en', 'Accept-Language' => 'pl'])
        ->assertJsonPath('data.0.name', 'Anniversary');
});

it('keeps messages in the Accept-Language language when a content locale is sent', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $venue = Venue::factory()->create();

    // The pairing, not the wording: a copy edit must not fail this. `date` has
    // no custom message, so it comes from lang/{en,pl}/validation.php.
    $message = fn (array $headers) => $this->postJson('/api/concerts', ['venue_id' => $venue->id], $headers)
        ->assertUnprocessable()
        ->json('errors.date.0');

    $english = $message(['Accept-Language' => 'en']);
    $polish  = $message(['Accept-Language' => 'pl']);
    expect($polish)->not->toBe($english);

    expect($message(['X-Content-Locale' => 'pl', 'Accept-Language' => 'en']))->toBe($english)
        ->and($message(['X-Content-Locale' => 'en', 'Accept-Language' => 'pl']))->toBe($polish);
});

it('lets ?lang= win over the header, as the public build relies on', function () {
    Concert::factory()->create(['name' => ['en' => 'Anniversary', 'pl' => 'Rocznica']]);

    $this->getJson('/api/concerts?lang=en', ['X-Content-Locale' => 'pl'])
        ->assertJsonPath('data.0.name', 'Anniversary');
});

it('ignores an unregistered X-Content-Locale', function () {
    Concert::factory()->create(['name' => ['en' => 'Anniversary', 'pl' => 'Rocznica']]);

    $this->getJson('/api/concerts', ['X-Content-Locale' => 'de', 'Accept-Language' => 'pl'])
        ->assertJsonPath('data.0.name', 'Rocznica');
});
