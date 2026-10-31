<?php

use App\Assistant\Crawler\TriageFindingsJob;
use App\Assistant\Text\TextModel;
use App\Models\AssistantFinding;
use App\Models\Band;
use App\Models\BandProfile;
use App\Models\Venue;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeTextModel;

// Triage: a cheap model reads the night's findings in batches and says which
// matter, how much, and in one line why — in the band's own language. Names
// the band already has, and the same page found twice, never reach the model.

beforeEach(function () {
    $this->model = new FakeTextModel();
    app()->instance(TextModel::class, $this->model);
    config(['assistant.triage_model_id' => 'claude-haiku-5-5']);
    BandProfile::factory()->create(['name' => 'Skanking Storks', 'genres' => 'ska, two-tone', 'hometown' => 'Kraków']);
});

function triage(): void
{
    (new TriageFindingsJob())->handle(app(TextModel::class));
}

function answer(array ...$items): array
{
    return ['items' => array_map(fn ($i) => $i + [
        'relevant' => true, 'score' => 50, 'summary' => 'Worth a look', 'reason' => 'ska venue',
        'lead_type' => null, 'country' => null, 'contacts' => null,
    ], $items)];
}

it('writes the score, summary, lead type and country the model gives, with the triage model', function () {
    $f = AssistantFinding::factory()->lead()->create(['title' => 'Klub Pod Minogą', 'country' => null, 'lead_type' => null]);
    $this->model->answerStructured(answer([
        'id' => $f->id, 'score' => 82, 'summary' => 'Klub w Krakowie, gra ska', 'lead_type' => 'venue', 'country' => 'PL',
        'contacts' => ['email' => 'booking@minoga.example', 'website' => null, 'instagram' => null, 'facebook' => null],
    ]));

    triage();

    $f->refresh();
    expect($f->score)->toBe(82)
        ->and($f->lead_type)->toBe('venue')
        ->and($f->country)->toBe('PL')
        ->and($f->triaged_at)->not->toBeNull()
        ->and($f->triage['summary'])->toBe('Klub w Krakowie, gra ska')
        ->and($f->triage['contacts']['email'])->toBe('booking@minoga.example')
        ->and($this->model->lastStructured['model'])->toBe('claude-haiku-5-5')
        ->and($this->model->lastStructured['system'])->toContain('Skanking Storks')
        ->and($this->model->lastStructured['user'])->toContain('Klub Pod Minogą');
});

it('scores an irrelevant finding 0', function () {
    $f = AssistantFinding::factory()->create(['score' => 0]);
    $this->model->answerStructured(answer(['id' => $f->id, 'relevant' => false, 'score' => 70]));

    triage();

    expect($f->fresh()->score)->toBe(0)->and($f->fresh()->triaged_at)->not->toBeNull();
});

it('marks a lead the band already has as known without asking the model', function () {
    Venue::factory()->create(['name' => 'Klub Pod Minogą']);
    $f = AssistantFinding::factory()->lead()->create(['title' => 'Klub pod Minoga, Kraków']);

    triage();

    $f->refresh();
    expect($this->model->lastStructured)->toBeNull()
        ->and($f->triage['known']['type'])->toBe('venue')
        ->and($f->score)->toBe(0)
        ->and($f->triaged_at)->not->toBeNull();
});

it('checks bands and contacts too', function () {
    Band::factory()->create(['name' => 'The Busters']);
    $f = AssistantFinding::factory()->lead()->create(['title' => 'The Busters — official']);

    triage();

    expect($f->fresh()->triage['known']['type'])->toBe('band');
});

it('marks the same page found by a second source as a duplicate', function () {
    $first  = AssistantFinding::factory()->create(['url' => 'https://ska.example/news?id=7', 'triaged_at' => now()]);
    $second = AssistantFinding::factory()->create(['source' => 'rss', 'url' => 'https://www.ska.example/news/?id=7&utm_source=x']);

    triage();

    expect($second->fresh()->triage['duplicate_of'])->toBe($first->id)
        ->and($this->model->lastStructured)->toBeNull();
});

it('leaves every row untouched when the model answers malformed JSON', function () {
    $a = AssistantFinding::factory()->create();
    $b = AssistantFinding::factory()->create();
    $this->model->answerStructured(['items' => [['id' => $a->id, 'score' => 'lots']]]);

    expect(fn () => triage())->toThrow(\RuntimeException::class);

    // Untriaged still — only the attempt is counted.
    expect($a->fresh()->triaged_at)->toBeNull()->and($b->fresh()->triaged_at)->toBeNull()
        ->and($a->fresh()->triage['attempts'])->toBe(1);
});

it('sets aside a finding the model failed on three times, so newer ones are not blocked', function () {
    $stuck = AssistantFinding::factory()->create(['triage' => ['attempts' => 3]]);
    $next  = AssistantFinding::factory()->create();
    $this->model->answerStructured(answer(['id' => $next->id]));

    triage();

    expect($stuck->fresh()->triage['unreadable'])->toBeTrue()
        ->and($stuck->fresh()->triaged_at)->not->toBeNull()
        ->and($stuck->fresh()->score)->toBe(0)
        ->and($next->fresh()->triaged_at)->not->toBeNull()
        ->and($this->model->lastStructured['user'])->not->toContain('"id": ' . $stuck->id . ',');
});

it('takes a lead type only for leads', function () {
    $news = AssistantFinding::factory()->create(['kind' => 'news', 'lead_type' => null]);
    $this->model->answerStructured(answer(['id' => $news->id, 'lead_type' => 'festival']));

    triage();

    expect($news->fresh()->lead_type)->toBeNull();
});

it('judges relevance by the band\'s own genres, and reads well with an empty profile', function () {
    BandProfile::query()->update(['genres' => 'jazz, soul']);
    $f = AssistantFinding::factory()->create();
    $this->model->answerStructured(answer(['id' => $f->id]));

    triage();

    expect($this->model->lastStructured['system'])->toContain('jazz, soul')->not->toContain('ska, reggae and punk');

    BandProfile::query()->update(['genres' => null, 'hometown' => null]);
    $g = AssistantFinding::factory()->create();
    $this->model->answerStructured(answer(['id' => $g->id]));
    triage();

    expect($this->model->lastStructured['system'])->not->toContain('a band that .');
});

it('leaves rows untouched when the answer skips one of them', function () {
    $a = AssistantFinding::factory()->create();
    $b = AssistantFinding::factory()->create();
    $this->model->answerStructured(answer(['id' => $a->id]));

    expect(fn () => triage())->toThrow(\RuntimeException::class);

    expect($a->fresh()->triaged_at)->toBeNull();
});

it('asks for summaries in the band\'s first content language', function () {
    \App\Support\ContentLocales::set(['pl', 'en']);
    $f = AssistantFinding::factory()->create();
    $this->model->answerStructured(answer(['id' => $f->id]));

    triage();

    expect($this->model->lastStructured['system'])->toContain('Polish');
});

it('skips dismissed and already-triaged findings', function () {
    AssistantFinding::factory()->dismissed()->create();
    AssistantFinding::factory()->create(['triaged_at' => now()]);

    triage();

    expect($this->model->lastStructured)->toBeNull();
});

it('is queued by assistant:triage only when a real text model is bound', function () {
    Queue::fake();
    // A driver named without its key resolves to the null model: queuing
    // triage then would fail every finding until it is set aside.
    config(['assistant.text_model' => 'anthropic']);
    app()->instance(TextModel::class, new \App\Assistant\Text\NullTextModel());
    $this->artisan('assistant:triage')->assertSuccessful();
    Queue::assertNotPushed(TriageFindingsJob::class);

    app()->instance(TextModel::class, $this->model);
    $this->artisan('assistant:triage')->assertSuccessful();
    Queue::assertPushed(TriageFindingsJob::class);
});
