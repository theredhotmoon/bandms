<?php

use App\Models\SiteSetting;
use App\Models\User;
use App\Support\ContentLocales;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

describe('GET /api/admin/content-locales', function () {
    it('serves the registry order when nothing is stored', function () {
        Passport::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/content-locales')
            ->assertOk()
            ->assertExactJson(['data' => ['order' => ['en', 'pl']]]);
    });

    it('is readable by a publisher, whose post editor needs it', function () {
        SiteSetting::set(ContentLocales::SETTING_KEY, json_encode(['pl', 'en']));
        Passport::actingAs(User::factory()->create(['role' => 'publisher']));

        $this->getJson('/api/admin/content-locales')
            ->assertOk()
            ->assertJsonPath('data.order', ['pl', 'en']);
    });

    it('requires authentication', function () {
        $this->getJson('/api/admin/content-locales')->assertUnauthorized();
    });
});

describe('PUT /api/admin/content-locales', function () {
    it('stores the order an admin chooses', function () {
        Passport::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/content-locales', ['order' => ['pl', 'en']])
            ->assertOk()
            ->assertJsonPath('data.order', ['pl', 'en']);

        expect(ContentLocales::order())->toBe(['pl', 'en'])
            ->and(ContentLocales::primary())->toBe('pl');
    });

    it('is admin-only', function () {
        Passport::actingAs(User::factory()->create(['role' => 'publisher']));

        $this->putJson('/api/admin/content-locales', ['order' => ['pl', 'en']])->assertForbidden();
    });

    it('rejects anything that is not a full permutation of the registry', function (array $order) {
        Passport::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/content-locales', ['order' => $order])->assertUnprocessable();

        expect(SiteSetting::get(ContentLocales::SETTING_KEY))->toBeNull();
    })->with([
        'partial'     => [['pl']],
        'duplicate'   => [['pl', 'pl']],
        'unregistered' => [['pl', 'de']],
        'too long'    => [['pl', 'en', 'en']],
        'empty'       => [[]],
    ]);
});

describe('ContentLocales::normalise', function () {
    it('drops a locale that is no longer registered', function () {
        expect(ContentLocales::normalise(['de', 'pl', 'en']))->toBe(['pl', 'en']);
    });

    // The case that matters when a third language is added: an order saved
    // before it existed must still put it in every form, not leave it out.
    it('appends a registered locale the stored order does not mention', function () {
        expect(ContentLocales::normalise(['pl']))->toBe(['pl', 'en']);
    });

    it('survives a corrupt stored value', function () {
        SiteSetting::set(ContentLocales::SETTING_KEY, 'not json');

        expect(ContentLocales::order())->toBe(['en', 'pl']);
    });
});

describe('slug generation for a title written only in the primary language', function () {
    beforeEach(function () {
        $this->createProfile(); // releases.profile_id is a foreign key
        SiteSetting::set(ContentLocales::SETTING_KEY, json_encode(['pl', 'en']));
        $this->actingAsAdmin();
    });

    // Before: `$title['en'] ?? reset($title)` found en => null twice over and
    // fell back to the literal 'post', so every Polish-only post got
    // /en/news/post, post-2, post-3...
    it('builds a post\'s slug_en from the Polish title instead of "post"', function () {
        $this->postJson('/api/posts', ['title' => ['en' => null, 'pl' => 'Nowa płyta']])
            ->assertCreated()
            ->assertJsonPath('data.slug_en', 'nowa-plyta')
            ->assertJsonPath('data.slug_pl', 'nowa-plyta');
    });

    it('builds a release\'s default slug from the Polish title instead of "release"', function () {
        $this->postJson('/api/releases', ['title' => ['en' => '', 'pl' => 'Debiut'], 'type' => 'LP'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'debiut');
    });

    it('still prefers the English title for slug_en when both exist', function () {
        $this->postJson('/api/posts', ['title' => ['en' => 'New record', 'pl' => 'Nowa płyta']])
            ->assertCreated()
            ->assertJsonPath('data.slug_en', 'new-record');
    });
});

// The admin sends every registered locale on save, a blank one as null.
// Omitting it instead (the first cut of compactBag) cannot clear anything:
// Spatie's setTranslations() merges, so a missing locale keeps its old text
// and "I deleted the English title" saves as a 200 that changed nothing.
describe('clearing one language of a title on update', function () {
    beforeEach(function () {
        $this->createProfile();
        $this->actingAsAdmin();
    });

    it('clears a post title locale sent as null', function () {
        $post = \App\Models\Post::factory()->create(['title' => ['en' => 'Old title', 'pl' => 'Nowy']]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => null, 'pl' => 'Nowy']])->assertOk();

        expect($post->fresh()->getTranslation('title', 'en', false))->toBe('')
            ->and($post->fresh()->getTranslation('title', 'pl', false))->toBe('Nowy');
    });

    // 'type' is fixed rather than echoed from the factory: ReleaseFactory picks
    // 'Single' a third of the time, which update()'s `in:...,single,...` rule
    // rejects, so echoing it made this test fail one run in three.
    it('clears a release title locale sent as null', function () {
        $release = \App\Models\Release::factory()->create(['title' => ['en' => 'Old title', 'pl' => 'Debiut']]);

        $this->putJson("/api/releases/{$release->id}", ['title' => ['en' => null, 'pl' => 'Debiut'], 'type' => 'LP'])->assertOk();

        expect($release->fresh()->getTranslation('title', 'en', false))->toBe('');
    });
});

it('clears every language of a post intro sent as an all-null bag', function () {
    $this->createProfile();
    $this->actingAsAdmin();
    $post = \App\Models\Post::factory()->create(['title' => ['en' => 'T'], 'intro' => ['pl' => 'Wstęp']]);

    $this->withHeader('Accept-Language', 'en')
        ->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'T'], 'intro' => ['en' => null, 'pl' => null]])
        ->assertOk();

    expect($post->fresh()->getTranslation('intro', 'pl', false))->toBe('');
});
