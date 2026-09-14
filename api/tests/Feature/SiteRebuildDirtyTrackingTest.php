<?php

use App\Models\SiteDirtyArea;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('upserts an area rather than appending a duplicate', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('concerts');

    expect(SiteDirtyArea::count())->toBe(1);
});

it('orders pending areas most-recently-changed first', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    $pending = SiteDirtyArea::pending();

    expect($pending)->toHaveCount(2);
    expect($pending[0]['area'])->toBe('faqs');
    expect($pending[1]['area'])->toBe('concerts');
});

it('clears every pending area', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    SiteDirtyArea::clearAll();

    expect(SiteDirtyArea::count())->toBe(0);
});
