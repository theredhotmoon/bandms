<?php

use App\Assistant\Text\StyleExamples;
use App\Models\Concert;
use App\Models\Faq;
use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Release;
use App\Models\Venue;
use App\Models\WebsiteModule;
use App\Support\Locales;

// "Write like us": the band's own recent texts of the same field and
// language, handed to the model as examples. Up to 4, newest first, each
// ≤1500 chars, never the text being rewritten itself.

$default = fn () => Locales::default();
$other   = fn () => collect(Locales::codes())->first(fn ($c) => $c !== Locales::default());

function concertWithDescription(string $locale, string $text): Concert
{
    $venue = Venue::first() ?? Venue::factory()->create();
    $c     = Concert::factory()->create(['venue_id' => $venue->id, 'description' => null]);
    $c->setTranslation('description', $locale, $text)->save();

    return $c;
}

it('returns the newest concert descriptions in the locale, excluding the current text', function () use ($default) {
    foreach (['one', 'two', 'three', 'four', 'five', 'current'] as $i => $word) {
        $c = concertWithDescription($default(), "Description {$word}.");
        $c->created_at = now()->subDays(10 - $i);
        $c->save();
    }

    $examples = StyleExamples::for('concert.description', $default(), 'Description current.');

    expect($examples)->toHaveCount(4)
        ->and($examples[0])->toBe('Description five.')
        ->and($examples)->not->toContain('Description current.');
});

it('ignores the other locale and blanks', function () use ($default, $other) {
    concertWithDescription($other(), 'Inny opis.');
    concertWithDescription($default(), '');
    concertWithDescription($default(), 'Kept.');

    expect(StyleExamples::for('concert.description', $default(), 'x'))->toBe(['Kept.']);
});

it('truncates a long example to 1500 characters', function () use ($default) {
    concertWithDescription($default(), str_repeat('a', 2000));

    expect(strlen(StyleExamples::for('concert.description', $default(), 'x')[0]))->toBe(1500);
});

it('returns nothing for a field it does not know', function () use ($default) {
    expect(StyleExamples::for('ghost.field', $default(), 'x'))->toBe([]);
});

it('reads post intros and text blocks, stripping a block instance suffix', function () use ($default) {
    $post = Post::factory()->create();
    $post->setTranslation('intro', $default(), 'An intro.')->save();
    PostBlock::factory()->for($post)->text('Paragraph one.', 'Akapit.')->create();

    expect(StyleExamples::for('post.intro', $default(), 'x'))->toBe(['An intro.'])
        ->and(StyleExamples::for('post.block.text#v-abc', $default(), 'x'))->toBe(['Paragraph one.']);
});

it('reads release descriptions and faq answers', function () use ($default) {
    $this->createProfile();
    $r = Release::factory()->create(['profile_id' => 1]);
    $r->setTranslation('description', $default(), 'Our record.')->save();
    Faq::create(['module_slug' => 'contact', 'question' => [$default() => 'Q?'], 'answer' => [$default() => 'An answer.'], 'is_published' => true]);

    // FAQs are seeded by a migration, so ours is the newest of several.
    expect(StyleExamples::for('release.description', $default(), 'x'))->toBe(['Our record.'])
        ->and(StyleExamples::for('faq.answer', $default(), 'x')[0])->toBe('An answer.');
});

it('offers the other bio variants as examples for a bio', function () use ($default) {
    $this->createProfile();
    $profile = \App\Models\BandProfile::first();
    $profile->setTranslation('bio_medium', $default(), 'Medium bio.');
    $profile->setTranslation('bio_long', $default(), 'Long bio.');
    $profile->setTranslation('bio_short', $default(), 'Short bio.');
    $profile->save();

    $examples = StyleExamples::for('profile.bio_short', $default(), 'Short bio.');

    expect($examples)->toContain('Medium bio.')->toContain('Long bio.')->not->toContain('Short bio.');
});

it('reads the same copy field on other modules', function () use ($default) {
    // Modules are seeded by a migration: overwrite their copy rather than insert.
    WebsiteModule::updateOrCreate(['slug' => 'concerts'], ['display_name' => 'Shows', 'settings' => ['lead' => [$default() => 'Shows lead.']]]);
    WebsiteModule::updateOrCreate(['slug' => 'about'], ['display_name' => 'About', 'settings' => ['lead' => [$default() => 'About lead.'], 'kicker' => [$default() => 'Kicker.']]]);

    $examples = StyleExamples::for('module.about.lead', $default(), 'About lead.');

    expect($examples)->toContain('Shows lead.')->not->toContain('About lead.')->not->toContain('Kicker.');
});
