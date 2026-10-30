<?php

use App\Assistant\Text\RewriteMode;
use App\Assistant\Text\TextModel;
use App\Models\Concert;
use App\Models\Venue;
use App\Support\Locales;
use Tests\Support\FakeTextModel;

// POST /api/admin/assistant/rewrite. The model is never real here: Task 4
// binds a FakeTextModel; until then only the unconfigured path is pinned.

function rewriteBody(array $overrides = []): array
{
    return array_merge([
        'text'      => 'Doors 19:00, Klub Hydrozagadka, 40 zł.',
        'format'    => 'text',
        'locale'    => Locales::default(),
        'mode'      => 'flow',
        'fieldKey'  => 'concert.description',
        'maxLength' => 2000,
    ], $overrides);
}

it('returns 401 anonymously', function () {
    $this->postJson('/api/admin/assistant/rewrite', rewriteBody())->assertUnauthorized();
});

it('answers 503 with a message when no text model is configured', function () {
    config(['assistant.text_model' => 'none']);
    $this->actingAsAssistantUser();

    $this->postJson('/api/admin/assistant/rewrite', rewriteBody())
        ->assertStatus(503)
        ->assertJsonStructure(['message']);
});

it('is rate limited under its own key', function () {
    $route = app('router')->getRoutes()->getByName('api.admin.assistant.rewrite');
    expect($route)->not->toBeNull()
        ->and($route->middleware())->toContain('throttle:30,1,assistant-rewrite');
});

dataset('rewrite modes', fn () => RewriteMode::values());

dataset('invalid rewrite bodies', [
    'blank text'      => [['text' => '   ']],
    'over the cap'    => [['text' => str_repeat('a', 20001), 'maxLength' => 20000]],
    'over the field'  => [['text' => str_repeat('a', 1501), 'maxLength' => 1500]],
    'unknown locale'  => [['locale' => 'xx']],
    'unknown mode'    => [['mode' => 'shout']],
    'bad format'      => [['format' => 'md']],
    'zero maxLength'  => [['maxLength' => 0]],
    'long fieldKey'   => [['fieldKey' => str_repeat('k', 201)]],
]);

describe('with a text model bound', function () {
    beforeEach(function () {
        config(['assistant.text_model' => 'anthropic']);
        $this->fake = new FakeTextModel();
        app()->instance(TextModel::class, $this->fake);
        $this->actingAsAssistantUser();
    });

    it('reports the rewrite capability on', function () {
        $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.rewrite', true);
    });

    it('rewrites in every mode and reports the mode', function (string $mode) {
        $this->postJson('/api/admin/assistant/rewrite', rewriteBody(['mode' => $mode]))
            ->assertOk()
            ->assertJsonPath('data.text', "[{$mode}] Doors 19:00, Klub Hydrozagadka, 40 zł.")
            ->assertJsonPath('data.mode', $mode)
            ->assertJsonPath('data.provider', 'fake');
    })->with('rewrite modes');

    it('hands the model the field cap and the band\'s own examples, never the current text', function () {
        $venue = Venue::factory()->create();
        foreach (['Older description.', 'Doors 19:00, Klub Hydrozagadka, 40 zł.'] as $text) {
            Concert::factory()->create(['venue_id' => $venue->id])->setTranslation('description', Locales::default(), $text)->save();
        }

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody(['maxLength' => 1500]))->assertOk();

        expect($this->fake->lastRewrite->maxLength)->toBe(1500)
            ->and($this->fake->lastRewrite->examples)->toBe(['Older description.']);
    });

    it('keeps html tags the model returns intact', function () {
        $html = '<p>x <a href="/y" target="_blank">z</a></p>';
        $this->fake->reply($html);

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody(['format' => 'html', 'text' => '<p>a</p>']))
            ->assertOk()->assertJsonPath('data.text', $html);
    });

    it('refuses html the editor never produces', function () {
        $this->fake->reply('<p>x</p><script>alert(1)</script>');

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody(['format' => 'html', 'text' => '<p>a</p>']))
            ->assertStatus(503)->assertJsonPath('message', 'Rewrite failed — try again.');
    });

    it('refuses a result longer than the field can hold', function () {
        $this->fake->reply(str_repeat('x', 2001));

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody(['maxLength' => 2000]))
            ->assertStatus(503)->assertJsonPath('message', 'The rewrite came out too long — try shorter.');
    });

    it('cleans quotes and a preamble off the result', function () {
        $this->fake->reply("Here is the flow version:\n\"Doors at seven.\"");

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody())
            ->assertOk()->assertJsonPath('data.text', 'Doors at seven.');
    });

    it('passes the model\'s own failure message through as a 503', function () {
        $this->fake->fail('The assistant is busy — try again in a minute.');

        $this->postJson('/api/admin/assistant/rewrite', rewriteBody())
            ->assertStatus(503)->assertJsonPath('message', 'The assistant is busy — try again in a minute.');
    });

    it('validates the body', function (array $bad) {
        $this->postJson('/api/admin/assistant/rewrite', rewriteBody($bad))->assertStatus(422);
        expect($this->fake->lastRewrite)->toBeNull();
    })->with('invalid rewrite bodies');
});
