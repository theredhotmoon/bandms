<?php

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Release;
use App\Models\SiteDirtyArea;
use App\Models\User;
use Laravel\Passport\Passport;

describe('GET /api/clips', function () {
    it('is public and lists clips with owners', function () {
        $concert = Concert::factory()->create();
        $clip = Clip::factory()->create(['title' => ['en' => 'Encore', 'pl' => 'Bis']]);
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->getJson('/api/clips')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'Encore')
            ->assertJsonPath('data.0.embed_id', 'dQw4w9WgXcQ')
            ->assertJsonPath('data.0.owners.0.type', 'concert')
            ->assertJsonPath('data.0.owners.0.id', $concert->id);
    });

    it('resolves the title for ?lang=pl', function () {
        Clip::factory()->create(['title' => ['en' => 'Encore', 'pl' => 'Bis']]);

        $this->getJson('/api/clips?lang=pl')->assertJsonPath('data.0.title', 'Bis');
    });
});

describe('POST /api/clips', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/76979871'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/76979871'])->assertForbidden();
    });

    it('creates a clip, stamps the provider and attaches owners', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();

        $this->postJson('/api/clips', [
            'url'      => 'https://vimeo.com/76979871',
            'title'    => ['en' => 'Soundcheck', 'pl' => null],
            'category' => 'backstage',
            'attach'   => [['type' => 'concert', 'id' => $concert->id]],
        ])->assertCreated()
          ->assertJsonPath('data.provider', 'vimeo')
          ->assertJsonPath('data.embed_id', '76979871')
          ->assertJsonPath('data.category', 'backstage')
          ->assertJsonPath('data.owners.0.type', 'concert');

        $this->assertDatabaseHas('clippables', ['clippable_type' => 'concert', 'clippable_id' => $concert->id]);
    });

    it('defaults the category to live and accepts a custom one', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1'])->assertCreated()->assertJsonPath('data.category', 'live');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/2', 'category' => 'charity gig'])
            ->assertCreated()->assertJsonPath('data.category', 'charity gig');
    });

    it('validates the url and the owner', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', ['url' => 'not a url'])->assertUnprocessable()->assertJsonValidationErrors('url');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'tour', 'id' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('attach.0.type');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'concert', 'id' => 999999]]])
            ->assertUnprocessable()->assertJsonValidationErrors('attach.0.id');
    });

    it('marks the owner area and posts dirty', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();

        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'concert', 'id' => $concert->id]]])->assertCreated();

        expect(SiteDirtyArea::pluck('area')->all())->toContain('concerts', 'posts');
    });
});

describe('PUT /api/clips/{clip}', function () {
    it('keeps the id and syncs attachments in array order', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        [$a, $b] = Concert::factory()->count(2)->create();
        $release = Release::factory()->create();
        $clip->concerts()->attach($a->id, ['position' => 0]);

        $this->putJson("/api/clips/{$clip->id}", [
            'url'    => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'attach' => [['type' => 'release', 'id' => $release->id], ['type' => 'concert', 'id' => $b->id]],
        ])->assertSuccessful()->assertJsonPath('data.id', $clip->id);

        $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $a->id]);
        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $b->id, 'position' => 1]);
        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'release', 'clippable_id' => $release->id, 'position' => 0]);
    });

    it('leaves attachments alone when attach is omitted', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        $concert = Concert::factory()->create();
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->putJson("/api/clips/{$clip->id}", ['url' => 'https://vimeo.com/9', 'title' => ['en' => 'Renamed']])->assertSuccessful();

        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_id' => $concert->id]);
    });

    it('re-stamps the provider when the url changes', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create(['provider' => 'youtube']);

        $this->putJson("/api/clips/{$clip->id}", ['url' => 'https://www.tiktok.com/@band/video/7234567890123456789'])
            ->assertSuccessful()->assertJsonPath('data.provider', 'tiktok');
    });
});

describe('attach / detach', function () {
    it('attaches and detaches one owner without touching the others', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        [$a, $b] = Concert::factory()->count(2)->create();
        $clip->concerts()->attach($a->id, ['position' => 0]);

        $this->postJson("/api/clips/{$clip->id}/attach", ['type' => 'concert', 'id' => $b->id])->assertSuccessful();
        expect($clip->fresh()->concerts()->count())->toBe(2);

        $this->deleteJson("/api/clips/{$clip->id}/attach", ['type' => 'concert', 'id' => $a->id])->assertSuccessful();
        expect($clip->fresh()->concerts()->pluck('concerts.id')->all())->toBe([$b->id]);
    });

    it('appends at the end of the owner list', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $first = Clip::factory()->create();
        $first->concerts()->attach($concert->id, ['position' => 3]);
        $second = Clip::factory()->create();

        $this->postJson("/api/clips/{$second->id}/attach", ['type' => 'concert', 'id' => $concert->id])->assertSuccessful();

        $this->assertDatabaseHas('clippables', ['clip_id' => $second->id, 'clippable_id' => $concert->id, 'position' => 4]);
    });

    it('marks the EPK area dirty when attaching an EPK-flagged clip', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $clip = Clip::factory()->create(['show_in_epk' => true]);

        $this->postJson("/api/clips/{$clip->id}/attach", ['type' => 'concert', 'id' => $concert->id])->assertSuccessful();

        expect(SiteDirtyArea::pluck('area')->all())->toContain('concerts', 'posts', 'band-profile');
    });
});

describe('DELETE /api/clips/{clip}', function () {
    it('deletes the clip and its pivot rows', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        $concert = Concert::factory()->create();
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->deleteJson("/api/clips/{$clip->id}")->assertNoContent();

        $this->assertDatabaseMissing('clips', ['id' => $clip->id]);
        $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id]);
    });
});
