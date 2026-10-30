<?php

use App\Support\Locales;

// What the admin may offer: a button is rendered only for a capability the
// server reports, so an unconfigured provider means no button — not a
// disabled one.

it('returns 401 anonymously', function () {
    $this->getJson('/api/admin/assistant/capabilities')->assertUnauthorized();
});

it('reports translate off when no translator is configured', function () {
    config(['assistant.translator' => 'none']);
    $this->actingAsAssistantUser();

    $this->getJson('/api/admin/assistant/capabilities')
        ->assertOk()
        ->assertJsonPath('data.translate', false)
        ->assertJsonPath('data.rewrite', false);
});

it('reports translate off when deepl is chosen but has no key', function () {
    config(['assistant.translator' => 'deepl', 'services.deepl.api_key' => '']);
    $this->actingAsAssistantUser();

    $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.translate', false);
});

it('reports rewrite off when no text model is configured', function () {
    config(['assistant.text_model' => 'none']);
    $this->actingAsAssistantUser();

    $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.rewrite', false);
});

it('reports rewrite off when anthropic is chosen but has no key', function () {
    config(['assistant.text_model' => 'anthropic', 'services.anthropic.api_key' => '']);
    $this->actingAsAssistantUser();

    $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.rewrite', false);
});

it('is readable by any authenticated user, not only admins', function () {
    config(['assistant.translator' => 'none']);
    $this->actingAsMember();

    $this->getJson('/api/admin/assistant/capabilities')->assertOk();
});

it('answers 503 on translate when no translator is configured', function () {
    config(['assistant.translator' => 'none']);
    $this->actingAsAssistantUser();

    $source = Locales::default();
    $target = collect(Locales::codes())->first(fn (string $c) => $c !== $source);

    $this->postJson('/api/admin/assistant/translate', ['items' => [[
        'key' => 'k', 'text' => 'Hello', 'format' => 'text',
        'source' => $source, 'target' => $target,
    ]]])->assertStatus(503)->assertJsonStructure(['message']);
});
