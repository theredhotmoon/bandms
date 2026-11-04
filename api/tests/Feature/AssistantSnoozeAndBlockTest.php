<?php

use App\Models\AssistantBlockedSite;
use App\Models\AssistantFinding;
use App\Models\User;
use Laravel\Passport\Passport;

// The inbox's two ways to say no: "Not now" (snooze for 1, 3 or 6 months,
// then back) and "Wrong" (dismiss, optionally blocking the whole site).

it('snoozes a finding out of the inbox, the widget and the digest until its date', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create(['title' => 'Later']);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'snoozed', 'snooze_months' => 3])
        ->assertOk()->assertJsonPath('data.status', 'snoozed');
    expect($f->fresh()->snoozed_until->toDateString())->toBe(now()->addMonths(3)->toDateString())
        ->and($this->getJson('/api/admin/assistant/findings')->json('data'))->toBe([])
        ->and($this->getJson('/api/admin/assistant/findings?status=snoozed')->json('data.0.title'))->toBe('Later')
        ->and($this->getJson('/api/admin/assistant/summary')->json('data.new.mention'))->toBe(0);

    $this->travel(3)->months();
    $this->travel(1)->minutes();

    expect($this->getJson('/api/admin/assistant/findings')->json('data.0.title'))->toBe('Later')
        ->and($f->fresh())->status->toBe('new')->snoozed_until->toBeNull();
});

it('wakes a snoozed finding for the dashboard widget too, not only the inbox', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->create(['status' => 'snoozed', 'snoozed_until' => now()->subMinute()]);

    expect($this->getJson('/api/admin/assistant/summary')->json('data.new.mention'))->toBe(1);
});

it('offers only 1, 3 or 6 months, and needs one to snooze', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create();

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'snoozed'])->assertStatus(422)->assertJsonValidationErrors('snooze_months');
    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'snoozed', 'snooze_months' => 2])->assertStatus(422);
    expect($f->fresh()->status)->toBe('new');
});

it('restores a snoozed finding early, clearing its date', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create(['status' => 'snoozed', 'snoozed_until' => now()->addMonth()]);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'new'])->assertOk();
    expect($f->fresh())->status->toBe('new')->snoozed_until->toBeNull();
});

it('keeps a saved finding saved, whatever is asked', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->lead()->create(['status' => 'saved']);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'snoozed', 'snooze_months' => 1])->assertStatus(422);
    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed', 'block_site' => true])->assertStatus(422);
    expect($f->fresh()->status)->toBe('saved')->and(AssistantBlockedSite::count())->toBe(0);
});

it('dismisses as wrong without blocking anything by default', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create(['url' => 'https://spam.example/a']);
    $other = AssistantFinding::factory()->create(['url' => 'https://spam.example/b']);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed'])
        ->assertOk()->assertJsonPath('meta.blocked', null);
    expect(AssistantBlockedSite::count())->toBe(0)->and($other->fresh()->status)->toBe('new');
});

it('blocks the whole site, and dismisses what else from there is new or snoozed', function () {
    $admin = $this->actingAsAdmin();
    $f       = AssistantFinding::factory()->create(['url' => 'https://www.spam.example/a']);
    $sibling = AssistantFinding::factory()->create(['url' => 'https://news.spam.example/b']);
    $asleep  = AssistantFinding::factory()->create(['url' => 'https://spam.example/c', 'status' => 'snoozed', 'snoozed_until' => now()->addMonth()]);
    $saved   = AssistantFinding::factory()->lead()->create(['url' => 'https://spam.example/d', 'status' => 'saved']);
    $elsewhere = AssistantFinding::factory()->create(['url' => 'https://good.example/a']);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed', 'block_site' => true])
        ->assertOk()
        ->assertJsonPath('data.status', 'dismissed')
        ->assertJsonPath('meta.blocked.key', 'spam.example')
        ->assertJsonPath('meta.also_dismissed', 2);

    expect(AssistantBlockedSite::sole())->site_key->toBe('spam.example')->created_by->toBe($admin->id)
        ->and($sibling->fresh()->status)->toBe('dismissed')
        ->and($asleep->fresh())->status->toBe('dismissed')->snoozed_until->toBeNull()
        ->and($saved->fresh()->status)->toBe('saved')
        ->and($elsewhere->fresh()->status)->toBe('new');
});

it('refuses to block a finding with no site to block, or with anything but a dismissal', function () {
    $this->actingAsAdmin();
    $post = AssistantFinding::factory()->create(['url' => 'https://www.instagram.com/p/Cxyz/']);
    $page = AssistantFinding::factory()->create(['url' => 'https://ok.example/a']);

    $this->patchJson("/api/admin/assistant/findings/{$post->id}", ['status' => 'dismissed', 'block_site' => true])
        ->assertStatus(422)->assertJsonValidationErrors('block_site');
    $this->patchJson("/api/admin/assistant/findings/{$page->id}", ['status' => 'snoozed', 'snooze_months' => 1, 'block_site' => true])
        ->assertStatus(422)->assertJsonValidationErrors('block_site');

    expect($post->fresh()->status)->toBe('new')->and(AssistantBlockedSite::count())->toBe(0);
});

it('says what each finding would block', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->create(['url' => 'https://www.instagram.com/klubstudio/', 'found_at' => now()]);
    AssistantFinding::factory()->create(['url' => 'https://www.instagram.com/p/Cxyz/', 'found_at' => now()->subDay()]);

    expect($this->getJson('/api/admin/assistant/findings')->json('data.*.site'))
        ->toBe([['key' => 'instagram.com/klubstudio', 'label' => 'instagram.com/klubstudio'], null]);
});

it('lists blocked sites and unblocks one, leaving its findings dismissed', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create(['url' => 'https://spam.example/a']);
    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed', 'block_site' => true])->assertOk();

    $site = $this->getJson('/api/admin/assistant/blocked-sites')->assertOk()->json('data.0');
    expect($site)->toMatchArray(['key' => 'spam.example', 'label' => 'spam.example']);

    $this->deleteJson("/api/admin/assistant/blocked-sites/{$site['id']}")->assertNoContent();
    expect(AssistantBlockedSite::count())->toBe(0)->and($f->fresh()->status)->toBe('dismissed');
});

it('keeps the blocked-sites list to admins', function () {
    $this->getJson('/api/admin/assistant/blocked-sites')->assertUnauthorized();

    $site = AssistantBlockedSite::create(['site_key' => 'spam.example', 'label' => 'spam.example']);
    Passport::actingAs(User::factory()->create(['role' => 'member']));
    $this->getJson('/api/admin/assistant/blocked-sites')->assertForbidden();
    $this->deleteJson("/api/admin/assistant/blocked-sites/{$site->id}")->assertForbidden();
    expect(AssistantBlockedSite::count())->toBe(1);
});
