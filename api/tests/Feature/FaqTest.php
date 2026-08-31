<?php

use App\Models\Faq;
use App\Models\User;
use App\Models\WebsiteModule;
use Laravel\Passport\Passport;

// The create_faqs_table migration seeds four published Contact questions so a
// fresh install renders a complete page — the same convention the baseline
// contact module follows. Counts below account for them.
const SEEDED_CONTACT_FAQS = 4;

// ── public read ───────────────────────────────────────────────────────────────

it('serves published faqs without auth', function () {
    $this->getJson('/api/faqs')
        ->assertOk()
        ->assertJsonCount(SEEDED_CONTACT_FAQS, 'data');
});

it('filters by module so each subpage gets only its own questions', function () {
    Faq::create([
        'module_slug' => 'concerts',
        'question'    => ['en' => 'Do you play festivals?'],
        'answer'      => ['en' => 'Yes.'],
    ]);

    $this->getJson('/api/faqs?module=concerts')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.question', 'Do you play festivals?');

    $this->getJson('/api/faqs?module=contact')
        ->assertOk()
        ->assertJsonCount(SEEDED_CONTACT_FAQS, 'data');
});

it('returns an empty list for a module with no questions', function () {
    $this->getJson('/api/faqs?module=merch')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('hides unpublished faqs from the public endpoint', function () {
    Faq::create([
        'module_slug'  => 'merch',
        'question'     => ['en' => 'Draft'],
        'answer'       => ['en' => 'Not ready'],
        'is_published' => false,
    ]);

    $this->getJson('/api/faqs?module=merch')->assertJsonCount(0, 'data');
});

it('orders by sort_order', function () {
    Faq::create(['module_slug' => 'press', 'question' => ['en' => 'Second'], 'answer' => ['en' => 'b'], 'sort_order' => 5]);
    Faq::create(['module_slug' => 'press', 'question' => ['en' => 'First'],  'answer' => ['en' => 'a'], 'sort_order' => 1]);

    $this->getJson('/api/faqs?module=press')
        ->assertJsonPath('data.0.question', 'First')
        ->assertJsonPath('data.1.question', 'Second');
});

it('resolves the requested locale', function () {
    Faq::create([
        'module_slug' => 'epk',
        'question'    => ['en' => 'Where is the bio?', 'pl' => 'Gdzie jest bio?'],
        'answer'      => ['en' => 'In the EPK.', 'pl' => 'W EPK.'],
    ]);

    $this->getJson('/api/faqs?module=epk&lang=pl')
        ->assertJsonPath('data.0.question', 'Gdzie jest bio?');
});

// A half-translated FAQ must show the language it has. Emitting null would
// render an empty accordion row and still build green.
it('falls back to the other locale rather than emitting an empty string', function () {
    Faq::create([
        'module_slug' => 'videos',
        'question'    => ['en' => 'English only'],
        'answer'      => ['en' => 'Still useful'],
    ]);

    $this->getJson('/api/faqs?module=videos&lang=pl')
        ->assertJsonPath('data.0.question', 'English only');
});

// ── admin ─────────────────────────────────────────────────────────────────────

it('requires auth for every write route', function () {
    $faq = Faq::create(['module_slug' => 'contact', 'question' => ['en' => 'q'], 'answer' => ['en' => 'a']]);

    $this->getJson('/api/admin/faqs')->assertUnauthorized();
    $this->postJson('/api/admin/faqs', [])->assertUnauthorized();
    $this->putJson("/api/admin/faqs/{$faq->id}", [])->assertUnauthorized();
    $this->deleteJson("/api/admin/faqs/{$faq->id}")->assertUnauthorized();
});

it('creates a faq against a real module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'New question', 'pl' => 'Nowe pytanie'],
        'answer'      => ['en' => 'New answer',   'pl' => 'Nowa odpowiedz'],
    ])->assertCreated()
      ->assertJsonPath('data.module_slug', 'contact')
      ->assertJsonPath('data.question.pl', 'Nowe pytanie');
});

// The per-locale length rules are generated from the registry rather than
// listed by hand. Nothing else in this suite would notice if that generation
// produced an empty set -- every rule is `sometimes|nullable`, so their absence
// looks exactly like a green run. This asserts they actually bite, on a
// non-default locale, which is the case a hardcoded 'en' would have missed.
it('applies the generated length rules to every registered locale', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    foreach (\App\Support\Locales::codes() as $locale) {
        $this->postJson('/api/admin/faqs', [
            'module_slug' => 'contact',
            'question'    => [$locale => str_repeat('q', 301)],
            'answer'      => [$locale => 'ok'],
        ])->assertStatus(422)->assertJsonValidationErrors("question.{$locale}");

        $this->postJson('/api/admin/faqs', [
            'module_slug' => 'contact',
            'question'    => [$locale => 'ok'],
            'answer'      => [$locale => str_repeat('a', 4001)],
        ])->assertStatus(422)->assertJsonValidationErrors("answer.{$locale}");
    }
});

it('rejects a module_slug that is not a real module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'not-a-module',
        'question'    => ['en' => 'q'],
        'answer'      => ['en' => 'a'],
    ])->assertJsonValidationErrors('module_slug');
});

// Switching a section off must not make its existing questions unsavable.
it('allows assigning to a disabled module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    WebsiteModule::where('slug', 'contact')->update(['enabled' => false]);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'q'],
        'answer'      => ['en' => 'a'],
    ])->assertCreated();
});

it('appends new questions to the end of their own module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    // Only the baseline contact module exists in a migrated-but-unseeded DB, and
    // module_slug is validated against live rows — so the target has to exist.
    WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Merch', 'enabled' => true, 'sort_order' => 1]);
    Faq::create(['module_slug' => 'merch', 'question' => ['en' => 'x'], 'answer' => ['en' => 'y'], 'sort_order' => 7]);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'merch',
        'question'    => ['en' => 'q'],
        'answer'      => ['en' => 'a'],
    ])->assertCreated()
      ->assertJsonPath('data.sort_order', 8);
});

// setTranslations() merges, so a one-locale payload must not blank the other.
it('leaves the other locale alone on a partial update', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $faq = Faq::create([
        'module_slug' => 'contact',
        'question'    => ['en' => 'English', 'pl' => 'Polski'],
        'answer'      => ['en' => 'A', 'pl' => 'O'],
    ]);

    $this->putJson("/api/admin/faqs/{$faq->id}", ['question' => ['en' => 'Changed']])
        ->assertOk()
        ->assertJsonPath('data.question.en', 'Changed')
        ->assertJsonPath('data.question.pl', 'Polski');
});

it('clears one locale when explicitly sent null', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $faq = Faq::create([
        'module_slug' => 'contact',
        'question'    => ['en' => 'English', 'pl' => 'Polski'],
        'answer'      => ['en' => 'A', 'pl' => 'O'],
    ]);

    $this->putJson("/api/admin/faqs/{$faq->id}", ['question' => ['pl' => null]])
        ->assertOk()
        ->assertJsonPath('data.question.pl', null)
        ->assertJsonPath('data.question.en', 'English');
});

it('reorders within one module without renumbering another', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $a     = Faq::create(['module_slug' => 'press', 'question' => ['en' => 'a'], 'answer' => ['en' => '1'], 'sort_order' => 0]);
    $b     = Faq::create(['module_slug' => 'press', 'question' => ['en' => 'b'], 'answer' => ['en' => '2'], 'sort_order' => 1]);
    $other = Faq::create(['module_slug' => 'merch', 'question' => ['en' => 'c'], 'answer' => ['en' => '3'], 'sort_order' => 9]);

    $this->putJson('/api/admin/faqs/reorder', [
        'module_slug' => 'press',
        'ids'         => [$b->id, $a->id],
    ])->assertOk();

    expect($b->fresh()->sort_order)->toBe(0)
        ->and($a->fresh()->sort_order)->toBe(1)
        ->and($other->fresh()->sort_order)->toBe(9);
});

it('deletes a faq', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    $faq = Faq::create(['module_slug' => 'contact', 'question' => ['en' => 'q'], 'answer' => ['en' => 'a']]);

    $this->deleteJson("/api/admin/faqs/{$faq->id}")->assertNoContent();
    expect(Faq::find($faq->id))->toBeNull();
});

// ── question is required (fixed 2026-08-27) ──────────────────────────────────

// Both columns are NOT NULL with no default, so omitting them died with a
// database error where a 422 belongs.
it('rejects a faq with no question rather than failing at the database', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', ['module_slug' => 'contact'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('question');
});

// A row with both locales blank renders an empty heading in the public
// accordion — the outcome the locale fallback exists to prevent.
it('rejects a faq whose question is blank in both locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => null, 'pl' => null],
    ])->assertStatus(422);
});

it('accepts a question in one locale only', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['pl' => 'Tylko po polsku'],
        'answer'      => ['pl' => 'Odpowiedz.'],
    ])->assertCreated();
});

// ── answer column and error keys (fixed 2026-08-27, round two) ──────────────

// `faqs.answer` is NOT NULL with no default too, so omitting the key left the
// column out of the INSERT — a database error where a 422 belongs. The admin UI
// always sends it, which is why this was invisible from the editor.
it('rejects a faq with no answer key rather than failing at the database', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Where are the drums?'],
    ])->assertStatus(422)
      ->assertJsonValidationErrors('answer');
});

it('accepts an answer that is blank in both locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    // An answer can legitimately be written later; a question cannot.
    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Where are the drums?'],
        'answer'      => ['en' => null, 'pl' => null],
    ])->assertCreated();
});

// The editor renders errors['question.en'|'question.pl'] and nothing for a bare
// `question`, so a message keyed there was invisible and the save looked like a
// silent no-op.
it('keys the missing-question error where the editor renders it', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $faq = Faq::create([
        'module_slug' => 'contact',
        'question'    => ['en' => 'English', 'pl' => 'Polski'],
        'answer'      => ['en' => 'A', 'pl' => 'O'],
    ]);

    $this->putJson("/api/admin/faqs/{$faq->id}", ['question' => ['en' => null, 'pl' => null]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['question.en', 'question.pl']);
});

// A payload whose locale keys we ignore leaves the attribute unset, so the
// INSERT omits a NOT NULL column — `required|array` validates presence, not that
// anything will be written.
// Previously a 500 (the column was never written); then a 201 that silently
// discarded the text. A 422 is the honest answer.
it('rejects an answer carrying only unsupported locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Where are the drums?'],
        'answer'      => ['de' => 'Hinten.'],
    ])->assertStatus(422)
      ->assertJsonValidationErrors('answer');
});

it('rejects an answer sent as a list rather than a locale map', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Where are the drums?'],
        'answer'      => ['Behind you.'],
    ])->assertStatus(422)
      ->assertJsonValidationErrors('answer');
});

// The column still has to be populated for a payload that validates but writes
// nothing — blank in both locales is legal.
it('stores a row when answer is blank in both locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Where are the drums?'],
        'answer'      => ['en' => null, 'pl' => null],
    ])->assertCreated();
});
