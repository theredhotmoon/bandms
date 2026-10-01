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
