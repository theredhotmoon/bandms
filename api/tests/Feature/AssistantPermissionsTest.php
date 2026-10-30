<?php

use App\Assistant\Text\TextModel;
use App\Models\User;
use App\Support\Locales;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;
use Tests\Support\FakeTextModel;

// Per-user permission for the assistant's token-spending features. Superadmins
// always have both; everyone else has only what a superadmin switched on.
// The server enforces it — capabilities hides the buttons, the endpoints 403.

beforeEach(function () {
    config(['assistant.translator' => 'deepl', 'services.deepl.api_key' => 'k:fx', 'assistant.text_model' => 'anthropic']);
    app()->instance(TextModel::class, new FakeTextModel());
    Http::fake(['api-free.deepl.com/*' => Http::response(['translations' => [['text' => 'x']]])]);
});

function actAsAssistantPermUser(array $attrs): User
{
    $user = User::factory()->create(array_merge(['role' => 'member'], $attrs));
    Passport::actingAs($user);

    return $user;
}

function permTranslateBody(): array
{
    return ['items' => [[
        'key' => 'k', 'text' => 'Hello', 'format' => 'text',
        'source' => Locales::default(),
        'target' => collect(Locales::codes())->first(fn ($c) => $c !== Locales::default()),
    ]]];
}

function permRewriteBody(): array
{
    return ['text' => 'Doors 19:00.', 'format' => 'text', 'locale' => Locales::default(), 'mode' => 'flow', 'fieldKey' => 'concert.description'];
}

it('reports both capabilities off for a user with neither permission', function () {
    actAsAssistantPermUser([]);
    $this->getJson('/api/admin/assistant/capabilities')
        ->assertJsonPath('data.translate', false)
        ->assertJsonPath('data.rewrite', false);
});

it('reports only what the user is allowed', function () {
    actAsAssistantPermUser(['can_translate' => true]);
    $this->getJson('/api/admin/assistant/capabilities')
        ->assertJsonPath('data.translate', true)
        ->assertJsonPath('data.rewrite', false);
});

it('gives a superadmin both regardless of the switches', function () {
    actAsAssistantPermUser(['role' => 'admin', 'is_superadmin' => true]);
    $this->getJson('/api/admin/assistant/capabilities')
        ->assertJsonPath('data.translate', true)
        ->assertJsonPath('data.rewrite', true);
});

it('still reports off when the user is allowed but no provider is configured', function () {
    config(['assistant.translator' => 'none']);
    actAsAssistantPermUser(['can_translate' => true]);
    $this->getJson('/api/admin/assistant/capabilities')->assertJsonPath('data.translate', false);
});

it('refuses translate with 403 for a user without the permission', function () {
    actAsAssistantPermUser(['can_enhance' => true]);
    $this->postJson('/api/admin/assistant/translate', permTranslateBody())->assertForbidden();
    Http::assertNothingSent();
});

it('refuses rewrite with 403 for a user without the permission', function () {
    actAsAssistantPermUser(['can_translate' => true]);
    $this->postJson('/api/admin/assistant/rewrite', permRewriteBody())->assertForbidden();
});

it('lets an allowed user through both', function () {
    actAsAssistantPermUser(['can_translate' => true, 'can_enhance' => true]);
    $this->postJson('/api/admin/assistant/translate', permTranslateBody())->assertOk();
    $this->postJson('/api/admin/assistant/rewrite', permRewriteBody())->assertOk();
});

it('exposes the flags on /api/user as booleans', function () {
    actAsAssistantPermUser(['can_translate' => true]);
    $this->getJson('/api/user')
        ->assertJsonPath('is_superadmin', false)
        ->assertJsonPath('can_translate', true)
        ->assertJsonPath('can_enhance', false);
});
