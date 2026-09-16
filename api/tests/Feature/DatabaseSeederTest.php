<?php

use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
    $posts = DB::table('website_modules')->where('slug', 'posts')->first();
    $contact = DB::table('website_modules')->where('slug', 'contact')->first();

    // The whole point of the extra columns: /pl/kontakt must not become
    // /pl/contact. Because the table was emptied first, these values can only
    // have come from the seeder.
    expect(json_decode($merch->custom_slug, true))->toBe(['en' => 'shop', 'pl' => 'shop'])
        // 'News' does not slugify to 'posts'. A fresh database must serve News
        // where every migrated one does, and the public E2E specs hardcode
        // /en/news, so a null here is a wrong URL rather than an absent one.
        ->and(json_decode($posts->custom_slug, true))->toBe(['en' => 'news', 'pl' => 'news'])
        ->and(json_decode($contact->custom_slug, true))->toBe(['en' => 'contact', 'pl' => 'kontakt'])
        ->and(json_decode($contact->custom_name, true))->toBe(['pl' => 'Kontakt']);
});

it('leaves the optional columns null on rows that declare none', function () {
    seedOntoEmptyModules();

    // `photos` declares no optional columns and its label slugifies to its key,
    // so the key fallback serves the right URL with nothing stored.
    $photos = DB::table('website_modules')->where('slug', 'photos')->first();

    // Padding rows to a uniform width must write NULL, not '' — an empty slug
    // is a *stored* slug, and web/src/lib/slugs.ts treats it differently from
    // an absent one.
    expect($photos->custom_name)->toBeNull()
        ->and($photos->custom_slug)->toBeNull();
});

/**
 * Drives DatabaseSeeder::uniformRows() — the shipped padding — rather than a
 * copy of it, so replacing the derived width with a hand-written list of
 * optional columns fails here instead of waiting for a future row to expose it.
 *
 * `settings` and `per_page` are the realistic case: both are real nullable
 * columns on this table, the contact and footer migrations already seed
 * `settings`, and neither is set by any row the seeder itself writes — which is
 * precisely where a hardcoded list would have stopped covering them.
 */
it('pads a row that sets a column no other row sets', function () {
    DB::table('website_modules')->delete();

    $defaults = ['enabled' => true, 'created_at' => now(), 'updated_at' => now()];

    $rows = DatabaseSeeder::uniformRows([
        ['slug' => 'alpha', 'display_name' => 'Alpha', 'sort_order' => 1],
        ['slug' => 'beta',  'display_name' => 'Beta',  'sort_order' => 2, 'settings' => json_encode(['lead' => 'x'])],
        ['slug' => 'gamma', 'display_name' => 'Gamma', 'sort_order' => 3, 'per_page' => 24],
    ], $defaults);

    // The property under test, asserted directly: one identical key set for
    // every row is what makes the insert below legal at all.
    $widths = array_map(static fn (array $row): array => array_keys($row), $rows);
    expect($widths[1])->toBe($widths[0])->and($widths[2])->toBe($widths[0]);

    DB::table('website_modules')->insertOrIgnore($rows);

    // `settings` is a json column: MySQL re-serialises it on read with a space
    // after the colon, so compare decoded values, never the raw stored text.
    expect(DB::table('website_modules')->count())->toBe(3)
        ->and(json_decode(DB::table('website_modules')->where('slug', 'beta')->value('settings'), true))->toBe(['lead' => 'x'])
        ->and(DB::table('website_modules')->where('slug', 'gamma')->value('per_page'))->toBe(24)
        ->and(DB::table('website_modules')->where('slug', 'alpha')->value('settings'))->toBeNull();
});

/**
 * Makes the "no other seeded label diverges from its key" invariant real rather
 * than hand-audited. Without this, adding
 *
 *     ['slug' => 'tickets', 'display_name' => 'Live Tickets', 'sort_order' => 12]
 *
 * reintroduces exactly the split this file exists to prevent: fresh databases
 * serve /en/tickets while every migrated one serves /en/live-tickets, because
 * the 2026_08_26_000002 backfill derived the slug from the label. The suite
 * would otherwise stay green, since the assertions above only cover the rows
 * that happen to declare a slug today.
 *
 * Str::slug stands in for that migration's private slugify(). The two agree on
 * every label seeded here; they can differ on Polish input, so a row whose
 * label is not ASCII needs an explicit custom_slug regardless of this test.
 */
it('stores an explicit slug on every module whose label does not slugify to its key', function () {
    seedOntoEmptyModules();

    $bare = DB::table('website_modules')->whereNull('custom_slug')->get();

    // Guard the guard: if nothing comes back the loop below asserts nothing.
    expect($bare)->not->toBeEmpty();

    foreach ($bare as $module) {
        expect(Str::slug($module->display_name))->toBe(
            $module->slug,
            "Module '{$module->slug}' stores no custom_slug, so it is served at "
            . "/en/{$module->slug} on a fresh database — but its label "
            . "'{$module->display_name}' derives '" . Str::slug($module->display_name)
            . "', which is where every migrated database serves it. Give the row "
            . 'an explicit custom_slug, the way posts and merch have one.'
        );
    }
});

it('is idempotent — a second run neither duplicates nor throws', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(DB::table('website_modules')->where('slug', 'merch')->count())->toBe(1)
        ->and(DB::table('band_profiles')->count())->toBe(1);
});
