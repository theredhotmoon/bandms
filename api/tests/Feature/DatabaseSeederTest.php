<?php

use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/**
 * The seeder is the only route to a working fresh database — `migrate:fresh
 * --seed`, `make fresh` and `rebuild.sh --fresh-db` all run it — and it had no
 * test at all.
 *
 * It was broken: the `website_modules` insert passed rows with differing column
 * sets (most rows carry six keys, `merch` adds `custom_slug`, `contact` adds
 * `custom_name` too). Laravel builds the INSERT column list from the *first*
 * row and then flattens the bindings from every row, so the statement went out
 * with six columns and eleven rows of mixed width:
 *
 *   SQLSTATE[21S01]: Column count doesn't match value count at row 7
 *
 * Row 7 is `merch` — the first row that differs. Every documented way to reset
 * this database therefore failed partway through, after the wipe.
 */
it('runs to completion', function () {
    $this->seed(DatabaseSeeder::class);
})->throwsNoExceptions();

it('seeds every website module, including the ones with extra columns', function () {
    $this->seed(DatabaseSeeder::class);

    $slugs = DB::table('website_modules')->pluck('slug')->all();

    // `merch` and `contact` are the rows that carry extra columns, so they are
    // the ones a width mismatch drops or corrupts — assert them by name rather
    // than trusting a count.
    expect($slugs)->toContain('concerts', 'releases', 'posts', 'photos', 'press')
        ->and($slugs)->toContain('videos', 'merch', 'epk', 'tech-rider', 'newsletter', 'contact');
});

it('keeps the per-locale slugs on the rows that declare them', function () {
    $this->seed(DatabaseSeeder::class);

    $merch = DB::table('website_modules')->where('slug', 'merch')->first();
    $contact = DB::table('website_modules')->where('slug', 'contact')->first();

    // The whole point of the extra columns: `/pl/kontakt` must not become
    // `/pl/contact`. Normalising the rows must not quietly drop these.
    expect(json_decode($merch->custom_slug, true))->toBe(['en' => 'shop', 'pl' => 'shop'])
        ->and(json_decode($contact->custom_slug, true))->toBe(['en' => 'contact', 'pl' => 'kontakt'])
        ->and(json_decode($contact->custom_name, true))->toBe(['pl' => 'Kontakt']);
});

it('leaves custom_name and custom_slug null on rows that declare neither', function () {
    $this->seed(DatabaseSeeder::class);

    $posts = DB::table('website_modules')->where('slug', 'posts')->first();

    // Padding the rows to a uniform width must write NULL, not '' — an empty
    // string is a *stored* slug, and `web/src/lib/slugs.ts` treats an empty
    // slug differently from an absent one.
    expect($posts->custom_name)->toBeNull()
        ->and($posts->custom_slug)->toBeNull();
});

it('is idempotent — a second run neither duplicates nor throws', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(DB::table('website_modules')->where('slug', 'merch')->count())->toBe(1)
        ->and(DB::table('band_profiles')->count())->toBe(1);
});
