<?php

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Release;

it('attaches a clip to a concert and reads it back in pivot order', function () {
    $concert = Concert::factory()->create();
    $a = Clip::factory()->create(['title' => ['en' => 'A']]);
    $b = Clip::factory()->create(['title' => ['en' => 'B']]);

    $concert->clips()->attach([$b->id => ['position' => 0], $a->id => ['position' => 1]]);

    expect($concert->fresh()->clips->pluck('id')->all())->toBe([$b->id, $a->id]);
});

it('lets one clip belong to owners of different kinds', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $release = Release::factory()->create();

    $clip->concerts()->attach($concert->id, ['position' => 0]);
    $clip->releases()->attach($release->id, ['position' => 0]);

    $owners = $clip->fresh()->load(['concerts.venue', 'releases', 'shopItems', 'albums'])->ownersList();

    expect(collect($owners)->pluck('type')->sort()->values()->all())->toBe(['concert', 'release']);
    expect(collect($owners)->firstWhere('type', 'concert')['id'])->toBe($concert->id);
});

it('stores the morph alias, not the class name', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $concert->id]);
});

it('removes pivot rows but not the clip when the owner is deleted', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $concert->delete();

    $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id]);
    $this->assertDatabaseHas('clips', ['id' => $clip->id]);
});

it('cascades pivot rows when the clip is deleted', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $clip->delete();

    $this->assertDatabaseMissing('clippables', ['clippable_id' => $concert->id, 'clippable_type' => 'concert']);
});
