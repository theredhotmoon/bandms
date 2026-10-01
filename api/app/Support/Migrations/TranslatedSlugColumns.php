<?php

namespace App\Support\Migrations;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Moves a table from slug_en/slug_pl columns to one translatable `slug` JSON
 * column, and back. Shared by the per-table migrations of the translated-slug
 * series, so all six convert their data identically.
 *
 * MIGRATIONS DEPEND ON THIS CLASS. They run again on every fresh database, so
 * its behaviour is frozen: change it only by adding a new method.
 *
 * The locale list is deliberately the literal pair the old columns held, not
 * the registry — this converts the columns that exist, whatever the registry
 * says on the day it runs.
 */
final class TranslatedSlugColumns
{
    private const COLUMNS = ['en' => 'slug_en', 'pl' => 'slug_pl'];

    public static function toBag(string $table): void
    {
        Schema::table($table, function (Blueprint $t) {
            $t->json('slug')->nullable()->after('slug_en');
        });

        $rows = DB::table($table)->orderBy('id')->get(['id', 'slug_en', 'slug_pl']);

        // slug_en and slug_pl were each unique per column, so the only clash the
        // new rule forbids is CROSS-column: one row's Polish slug equal to
        // another row's English one. Drop the Polish half of such a pair: the
        // English slug is the one every public route falls back to, and a
        // /pl/ path that collided was already shadowed — Astro built one page.
        $englishOwner = $rows->filter(fn ($r) => filled($r->slug_en))->pluck('id', 'slug_en');

        foreach ($rows as $row) {
            $bag = [];
            foreach (self::COLUMNS as $locale => $column) {
                if (filled($row->{$column})) {
                    $bag[$locale] = $row->{$column};
                }
            }

            if (isset($bag['pl'])) {
                $owner = $englishOwner[$bag['pl']] ?? null;
                if ($owner !== null && $owner !== $row->id) {
                    Log::warning("translated-slugs: {$table}#{$row->id} dropped slug_pl '{$bag['pl']}', "
                        . "which is {$table}#{$owner}'s slug_en");
                    unset($bag['pl']);
                }
            }

            DB::table($table)->where('id', $row->id)
                ->update(['slug' => $bag === [] ? null : json_encode($bag)]);
        }

        self::dropIndexesOn($table, array_values(self::COLUMNS));

        Schema::table($table, function (Blueprint $t) {
            $t->dropColumn(array_values(self::COLUMNS));
        });
    }

    /**
     * Restores the two columns (nullable, each unique) from the bag. A locale
     * other than en/pl has no column to return to and is lost — the rollback
     * of a feature whose point is supporting more than two.
     */
    public static function toColumns(string $table): void
    {
        Schema::table($table, function (Blueprint $t) {
            $t->string('slug_en')->nullable()->after('slug');
            $t->string('slug_pl')->nullable()->after('slug_en');
        });

        foreach (DB::table($table)->orderBy('id')->get(['id', 'slug']) as $row) {
            $bag = json_decode((string) $row->slug, true) ?: [];
            DB::table($table)->where('id', $row->id)->update([
                'slug_en' => $bag['en'] ?? null,
                'slug_pl' => $bag['pl'] ?? null,
            ]);
        }

        Schema::table($table, function (Blueprint $t) {
            $t->dropColumn('slug');
            $t->unique('slug_en');
            $t->unique('slug_pl');
        });
    }

    /** Drop every index touching these columns, whatever it was named. */
    private static function dropIndexesOn(string $table, array $columns): void
    {
        foreach (Schema::getIndexes($table) as $index) {
            if ($index['primary'] || array_intersect($index['columns'], $columns) === []) {
                continue;
            }

            Schema::table($table, fn (Blueprint $t) => $t->dropIndex($index['name']));
        }
    }
}
