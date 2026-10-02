<?php

use App\Models\Tag;
use App\Support\Migrations\TranslatedSlugColumns;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

/*
 * The translated-slug series: slug_en/slug_pl columns become one `slug` bag.
 * These pin the shared pieces — the uniqueness rule and the column migration —
 * once, rather than per table.
 */
describe('cross-locale slug uniqueness', function () {
    // The #83 bug, now impossible for every model: one record's Polish slug
    // equal to another's English one. Per-column unique rules never saw it.
    it('rejects a Polish slug that is another tag\'s English slug', function () {
        $this->actingAsAdmin();
        Tag::factory()->create(['name' => ['en' => 'Live'], 'slug' => ['en' => 'live']]);

        $this->postJson('/api/tags', ['name' => ['en' => 'Concert', 'pl' => 'Koncert'], 'slug' => ['pl' => 'live']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug.pl']);
    });

    it('lets one tag use the same slug in two languages', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['en' => 'Rock', 'pl' => 'Rock']])
            ->assertCreated()
            ->assertJsonPath('data.translations.slug.en', 'rock')
            ->assertJsonPath('data.translations.slug.pl', 'rock');
    });

    it('suffixes a generated slug past every locale of other tags', function () {
        $this->actingAsAdmin();
        Tag::factory()->create(['name' => ['en' => 'Other'], 'slug' => ['en' => 'other', 'pl' => 'jazz']]);

        $this->postJson('/api/tags', ['name' => ['en' => 'Jazz']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'jazz-2');
    });

    it('rejects a slug for a locale that is not registered', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/tags', ['name' => ['en' => 'Folk'], 'slug' => ['de' => 'volk']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    });
});

describe('TranslatedSlugColumns', function () {
    beforeEach(function () {
        Schema::create('slug_probe', function (Blueprint $t) {
            $t->id();
            $t->string('slug_en')->nullable()->unique();
            $t->string('slug_pl')->nullable()->unique();
        });
    });

    it('moves both columns into one bag and drops them', function () {
        DB::table('slug_probe')->insert([
            ['slug_en' => 'rock', 'slug_pl' => 'rok'],
            ['slug_en' => 'jazz', 'slug_pl' => null],
            ['slug_en' => null,   'slug_pl' => null],
        ]);

        TranslatedSlugColumns::toBag('slug_probe');

        expect(Schema::hasColumns('slug_probe', ['slug_en']))->toBeFalse()
            ->and(Schema::hasColumns('slug_probe', ['slug_pl']))->toBeFalse()
            ->and(DB::table('slug_probe')->orderBy('id')->pluck('slug')->all())
            ->toBe(['{"en":"rock","pl":"rok"}', '{"en":"jazz"}', null]);
    });

    // A Polish slug equal to ANOTHER row's English one is exactly what the new
    // rule forbids, so it cannot be carried over. The Polish half goes: English
    // is what every public route falls back to.
    it('drops a Polish slug that collides with another row\'s English slug', function () {
        DB::table('slug_probe')->insert([
            ['slug_en' => 'live',   'slug_pl' => null],
            ['slug_en' => 'concert', 'slug_pl' => 'live'],
        ]);

        TranslatedSlugColumns::toBag('slug_probe');

        expect(DB::table('slug_probe')->orderBy('id')->pluck('slug')->all())
            ->toBe(['{"en":"live"}', '{"en":"concert"}']);
    });

    it('rolls back to the two columns', function () {
        DB::table('slug_probe')->insert([['slug_en' => 'rock', 'slug_pl' => 'rok']]);

        TranslatedSlugColumns::toBag('slug_probe');
        TranslatedSlugColumns::toColumns('slug_probe');

        expect(Schema::hasColumn('slug_probe', 'slug'))->toBeFalse()
            ->and((array) DB::table('slug_probe')->first(['slug_en', 'slug_pl']))
            ->toBe(['slug_en' => 'rock', 'slug_pl' => 'rok']);
    });
});

/*
 * applySlugBag(): the generate-once policy every model but Tag uses.
 * Exercised through albums, the first table on it.
 */
describe('the generate-once slug policy (albums)', function () {
    beforeEach(fn () => $this->actingAsAdmin());

    it('takes a given slug and clears a blank non-default locale', function () {
        $album = \App\Models\Album::create(['title' => 'Summer', 'slug' => ['en' => 'summer', 'pl' => 'lato']]);

        $this->putJson("/api/albums/{$album->id}", ['slug' => ['en' => 'summer-2026', 'pl' => '']])
            ->assertOk()
            ->assertJsonPath('data.translations.slug', ['en' => 'summer-2026', 'pl' => null]);
    });

    // The default locale is the record's stable slug: blanking it keeps it.
    it('never blanks the default locale', function () {
        $album = \App\Models\Album::create(['title' => 'Summer', 'slug' => ['en' => 'summer']]);

        $this->putJson("/api/albums/{$album->id}", ['slug' => ['en' => '', 'pl' => 'lato']])
            ->assertOk()
            ->assertJsonPath('data.translations.slug', ['en' => 'summer', 'pl' => 'lato']);
    });

    // A partial update must not clear what the client did not mention.
    it('leaves locales absent from the payload alone', function () {
        $album = \App\Models\Album::create(['title' => 'Summer', 'slug' => ['en' => 'summer', 'pl' => 'lato']]);

        $this->putJson("/api/albums/{$album->id}", ['title' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('data.translations.slug', ['en' => 'summer', 'pl' => 'lato']);
    });

    it('rejects a slug another album uses in another language', function () {
        \App\Models\Album::create(['title' => 'Winter', 'slug' => ['en' => 'winter', 'pl' => 'zima']]);
        $album = \App\Models\Album::create(['title' => 'Snow', 'slug' => ['en' => 'snow']]);

        $this->putJson("/api/albums/{$album->id}", ['slug' => ['en' => 'zima']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug.en']);
    });
});

describe('release slugs', function () {
    beforeEach(function () {
        $this->createProfile();
        $this->actingAsAdmin();
    });

    // On create every titled locale gets a slug from its own title, as the
    // slug_en/slug_pl code always did for Polish.
    it('generates a slug per titled locale on create', function () {
        $this->postJson('/api/releases', ['title' => ['en' => 'Debut', 'pl' => 'Debiut'], 'type' => 'LP'])
            ->assertCreated()
            ->assertJsonPath('data.translations.slug', ['en' => 'debut', 'pl' => 'debiut']);
    });

    // update() used to write the raw columns, so a payload carrying a null
    // English slug wiped the release's slug. The default is never blanked now.
    it('keeps the default slug when an update sends it blank', function () {
        $release = \App\Models\Release::factory()->create(['title' => ['en' => 'Debut'], 'slug' => ['en' => 'debut'], 'type' => 'LP']);

        $this->putJson("/api/releases/{$release->id}", ['title' => ['en' => 'Debut'], 'type' => 'LP', 'slug' => ['en' => null]])
            ->assertOk()
            ->assertJsonPath('data.slug', 'debut');
    });

    // Adding a Polish title later must not invent a Polish URL.
    it('does not generate a Polish slug when a Polish title is added on update', function () {
        $release = \App\Models\Release::factory()->create(['title' => ['en' => 'Debut'], 'slug' => ['en' => 'debut'], 'type' => 'LP']);

        $this->putJson("/api/releases/{$release->id}", ['title' => ['en' => 'Debut', 'pl' => 'Debiut'], 'type' => 'LP'])
            ->assertOk()
            ->assertJsonPath('data.translations.slug.pl', null);
    });
});

describe('concert slugs', function () {
    beforeEach(fn () => $this->actingAsAdmin());

    // On create every locale gets a slug — from its own name, else venue +
    // date — which the admin form always generated client-side for Polish.
    it('generates every locale on create, from the name or venue + date', function () {
        $venue = \App\Models\Venue::factory()->create(['name' => 'Klub Pod Jaszczurami']);

        $this->postJson('/api/concerts', ['venue_id' => $venue->id, 'date' => '2099-06-17', 'name' => ['en' => 'Summer Gig']])
            ->assertCreated()
            ->assertJsonPath('data.translations.slug', ['en' => 'summer-gig', 'pl' => 'klub-pod-jaszczurami-2099-06-17']);
    });

    // update() used to write the raw columns, so clearing a concert's slug in
    // the admin moved its public page to /concert-{id}.
    it('keeps the slug when an update sends it blank', function () {
        $concert = \App\Models\Concert::factory()->create(['slug' => ['en' => 'summer-gig']]);

        $this->putJson("/api/concerts/{$concert->id}", ['slug' => ['en' => null]])
            ->assertOk()
            ->assertJsonPath('data.slug', 'summer-gig');
    });

    // The URL a slug-less concert has always been served at.
    it('serves concert-{id} for a concert with no slug', function () {
        $concert = \App\Models\Concert::factory()->create();
        \Illuminate\Support\Facades\DB::table('concerts')->where('id', $concert->id)->update(['slug' => null]);

        $this->getJson("/api/concerts/{$concert->id}")
            ->assertOk()
            ->assertJsonPath('data.slug', "concert-{$concert->id}");
    });
});

// The concerts migration writes the concert-{id} fallback in as data, so the
// first save after it cannot generate a new slug and move the page.
it('backfills concert-{id} for slug-less concerts in the concerts migration', function () {
    $migration = require database_path('migrations/2026_10_02_000005_translate_concert_slugs.php');
    $migration->down();

    $id = \Illuminate\Support\Facades\DB::table('concerts')->insertGetId([
        'venue_id' => \App\Models\Venue::factory()->create()->id, 'date' => '2099-01-01',
        'slug_en' => null, 'slug_pl' => null, 'created_at' => now(), 'updated_at' => now(),
    ]);

    $migration->up();

    expect(\Illuminate\Support\Facades\DB::table('concerts')->where('id', $id)->value('slug'))
        ->toBe(json_encode(['en' => "concert-{$id}"]));
});
