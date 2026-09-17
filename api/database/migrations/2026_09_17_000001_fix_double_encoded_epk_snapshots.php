<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * EpkVersionController::store() used to json_encode() the snapshot before
 * handing it to a column cast as `array`, so every row written before this
 * migration holds a JSON string of JSON — `"{\"name\":...}"` — and reads back
 * as a string rather than an object. Decode one level on those rows.
 *
 * Runs once and is deliberately irreversible: re-encoding would reintroduce
 * the bug.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('epk_versions')
            ->select(['id', 'snapshot'])
            ->orderBy('id')
            ->each(function (object $row): void {
                $decoded = json_decode($row->snapshot, true);

                // A correctly stored row decodes straight to an array; a
                // double-encoded one decodes to the inner JSON string.
                if (! is_string($decoded)) {
                    return;
                }

                DB::table('epk_versions')
                    ->where('id', $row->id)
                    ->update(['snapshot' => $decoded]);
            });
    }

    public function down(): void
    {
        // Intentionally empty.
    }
};
