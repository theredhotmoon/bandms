<?php

use App\Models\AssistantFinding;
use App\Models\Author;
use App\Models\Band;
use App\Models\Venue;

// Save as…: the admin creates the venue, band or contact through the usual
// endpoint (its own validation, its own 422s), then links it here. Only then
// does the finding become `saved`, and the record remembers where it came from.

it('links a finding to the venue made from it', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->lead()->create();
    $venue = Venue::factory()->create();

    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'venue', 'id' => $venue->id])
        ->assertOk()
        ->assertJsonPath('data.status', 'saved')
        ->assertJsonPath('data.saved_type', 'venue')
        ->assertJsonPath('data.saved_id', $venue->id);

    expect($venue->fresh()->source)->toBe("assistant:{$f->id}");
});

it('links bands and contacts too, and keeps a source already set', function () {
    $this->actingAsAdmin();
    $band   = Band::factory()->create(['source' => 'manual']);
    $author = Author::create(['first_name' => 'Anna']);
    $f1 = AssistantFinding::factory()->lead()->create();
    $f2 = AssistantFinding::factory()->lead()->create();

    $this->postJson("/api/admin/assistant/findings/{$f1->id}/saved", ['type' => 'band', 'id' => $band->id])->assertOk();
    $this->postJson("/api/admin/assistant/findings/{$f2->id}/saved", ['type' => 'author', 'id' => $author->id])->assertOk();

    expect($band->fresh()->source)->toBe('manual')
        ->and($author->fresh()->source)->toBe("assistant:{$f2->id}");
});

it('refuses a record that does not exist, an unknown type, or a finding already saved', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->lead()->create();

    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'venue', 'id' => 999999])->assertStatus(422);
    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'concert', 'id' => 1])->assertStatus(422);
    expect($f->fresh()->status)->toBe('new');

    $venue = Venue::factory()->create();
    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'venue', 'id' => $venue->id])->assertOk();
    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'venue', 'id' => $venue->id])->assertStatus(422);
});

it('keeps Save as… to admins', function () {
    $this->actingAsUser();
    $f = AssistantFinding::factory()->lead()->create();

    $this->postJson("/api/admin/assistant/findings/{$f->id}/saved", ['type' => 'venue', 'id' => 1])->assertForbidden();
});

it('lists a finding with what triage knew about it', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->lead()->create([
        'triage' => ['known' => ['type' => 'venue', 'id' => 3, 'name' => 'SO36'], 'contacts' => ['email' => 'a@b.c']],
    ]);

    $row = $this->getJson('/api/admin/assistant/findings')->assertOk()->json('data.0');

    expect($row['known'])->toBe(['type' => 'venue', 'id' => 3, 'name' => 'SO36'])
        ->and($row['contacts'])->toBe(['email' => 'a@b.c']);
});

it('saves only a lead that is still new', function () {
    $this->actingAsAdmin();
    $venue = Venue::factory()->create();
    $news = AssistantFinding::factory()->create(['kind' => 'news']);
    $gone = AssistantFinding::factory()->lead()->dismissed()->create();

    $this->postJson("/api/admin/assistant/findings/{$news->id}/saved", ['type' => 'venue', 'id' => $venue->id])->assertStatus(422);
    $this->postJson("/api/admin/assistant/findings/{$gone->id}/saved", ['type' => 'venue', 'id' => $venue->id])->assertStatus(422);
    expect($news->fresh()->status)->toBe('new')->and($gone->fresh()->status)->toBe('dismissed');
});
