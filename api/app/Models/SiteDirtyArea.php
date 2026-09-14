<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per content area with unrebuilt changes. Upserted, never appended —
 * a second edit to the same area just bumps `changed_at`.
 */
class SiteDirtyArea extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'area';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['area', 'changed_at'];

    protected $casts = ['changed_at' => 'datetime'];

    public static function markDirty(string $area): void
    {
        static::updateOrCreate(['area' => $area], ['changed_at' => now()]);
    }

    public static function clearAll(): void
    {
        static::query()->delete();
    }

    /** Most-recently-changed first, so the admin's pending list reads newest-on-top. */
    public static function pending(): array
    {
        return static::orderByDesc('changed_at')
            ->get()
            ->map(fn (self $row) => [
                'area'      => $row->area,
                'changedAt' => $row->changed_at?->toISOString(),
            ])
            ->all();
    }
}
