<?php

use App\Models\SiteDirtyArea;
use Illuminate\Support\Carbon;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('upserts an area rather than appending a duplicate', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('concerts');

    expect(SiteDirtyArea::count())->toBe(1);
});

it('orders pending areas most-recently-changed first', function () {
    Carbon::setTestNow('2026-01-01 00:00:00');
    SiteDirtyArea::markDirty('concerts');

    Carbon::setTestNow('2026-01-01 00:01:00');
    SiteDirtyArea::markDirty('faqs');

    Carbon::setTestNow();

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
