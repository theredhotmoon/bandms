<?php

use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/**
 * The seeder is the only route to a working fresh database — `migrate:fresh
 * --seed`, `make fresh` and `rebuild.sh --fresh-db` all run it — and it had no
 * test at all.
 *
 * It was broken: the `website_modules` insert passed rows with differing column
 * sets (most rows carried six keys, `merch` added `custom_slug`, `contact`
 * added `custom_name` too). Laravel builds the INSERT column list from the
 * *first* row and then flattens the bindings from every row, so the statement
 * went out with six columns and eleven rows of mixed width:
 *
 *   SQLSTATE[21S01]: Column count doesn't match value count at row 7
 *
 * Row 7 is `merch` — the first row that differs. Every documented way to reset
 * this database therefore failed partway through, after the wipe.
 */

/**
 * Clears the rows the *migrations* insert, so the seeder is the thing under
 * test.
 *
 * This matters more than it looks. `2026_08_26_000001_add_contact_website_module`
 * creates `contact` and `2026_08_26_000002` backfills its `custom_slug`, both
 * long before RefreshDatabase hands control to the test — and `slug` is unique,
 * so the seeder's own `contact` row is silently discarded by insertOrIgnore.
 * Asserting contact's values straight after seeding therefore passes whatever
 * the seeder says, including nothing at all: the first version of this file did
 * exactly that and would have stayed green with the seeder's contact slugs
 * deleted outright.
 */
function seedOntoEmptyModules(): void
{
    DB::table('website_modules')->delete();
    app(DatabaseSeeder::class)->run();
}

it('runs to completion', function () {
    $this->seed(DatabaseSeeder::class);
})->throwsNoExceptions();

it('seeds every website module, including the ones with extra columns', function () {
    seedOntoEmptyModules();

    $slugs = DB::table('website_modules')->pluck('slug')->all();

    expect($slugs)->toContain('concerts', 'releases', 'posts', 'photos', 'press')
        ->and($slugs)->toContain('videos', 'merch', 'epk', 'tech-rider', 'newsletter', 'contact');
});

it('writes the per-locale slugs on the rows that declare them', function () {
    seedOntoEmptyModules();

    $merch = DB::table('website_modules')->where('slug', 'merch')->first();
    $contact = DB::table('website_modules')->where('slug', 'contact')->first();

    // The whole point of the extra columns: /pl/kontakt must not become
    // /pl/contact. Because the table was emptied first, these values can only
    // have come from the seeder.
    expect(json_decode($merch->custom_slug, true))->toBe(['en' => 'shop', 'pl' => 'shop'])
        ->and(json_decode($contact->custom_slug, true))->toBe(['en' => 'contact', 'pl' => 'kontakt'])
        ->and(json_decode($contact->custom_name, true))->toBe(['pl' => 'Kontakt']);
});

it('leaves the optional columns null on rows that declare none', function () {
    seedOntoEmptyModules();

    $posts = DB::table('website_modules')->where('slug', 'posts')->first();

    // Padding rows to a uniform width must write NULL, not '' — an empty slug
    // is a *stored* slug, and web/src/lib/slugs.ts treats it differently from
    // an absent one.
    expect($posts->custom_name)->toBeNull()
        ->and($posts->custom_slug)->toBeNull();
});

/**
 * The width is derived from the rows rather than from a hand-written list of
 * optional columns, so a row that sets a column no other row sets stays safe.
 * `settings` is the realistic case — the contact and footer migrations already
 * seed default copy into it — and it is absent from every row here, which is
 * precisely when a hardcoded list would have stopped covering it.
 */
it('survives a row that sets a column no other row sets', function () {
    DB::table('website_modules')->delete();

    $defaults = ['enabled' => true, 'created_at' => now(), 'updated_at' => now()];
    $modules = [
        ['slug' => 'alpha', 'display_name' => 'Alpha', 'sort_order' => 1],
        ['slug' => 'beta',  'display_name' => 'Beta',  'sort_order' => 2, 'settings' => json_encode(['lead' => 'x'])],
        ['slug' => 'gamma', 'display_name' => 'Gamma', 'sort_order' => 3, 'per_page' => 24],
    ];

    $width = array_fill_keys(array_keys(array_merge($defaults, ...$modules)), null);

    DB::table('website_modules')->insertOrIgnore(
        array_map(static fn (array $m): array => array_merge($width, $defaults, $m), $modules)
    );

    expect(DB::table('website_modules')->count())->toBe(3)
        ->and(DB::table('website_modules')->where('slug', 'beta')->value('settings'))->toBe(json_encode(['lead' => 'x']))
        ->and(DB::table('website_modules')->where('slug', 'gamma')->value('per_page'))->toBe(24)
        ->and(DB::table('website_modules')->where('slug', 'alpha')->value('settings'))->toBeNull();
});

it('is idempotent — a second run neither duplicates nor throws', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(DB::table('website_modules')->where('slug', 'merch')->count())->toBe(1)
        ->and(DB::table('band_profiles')->count())->toBe(1);
});
