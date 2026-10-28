<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL DDL commits as it goes, so a run that dies after this step
        // leaves the columns behind; the guard lets a re-run carry on.
        if (! Schema::hasColumn('authors', 'first_name')) {
            Schema::table('authors', function (Blueprint $table) {
                // Nullable only until the backfill below has filled it.
                $table->string('first_name')->nullable()->after('id');
                // Optional for good: a contact can be one word ("Radio 357").
                $table->string('last_name')->nullable()->after('first_name');
            });
        }

        // First word is the first name, the rest the last name — right for
        // "Anna Kowalska" and "Jan van der Berg", wrong for a double first
        // name, which the band can fix in the form. down() rejoins the halves
        // with one space, so a name holding a run of whitespace comes back
        // normalised — the words survive, the spacing does not.
        //
        // No regex: preg_split with /u returns false on invalid UTF-8 (first_name
        // written NULL, the NOT NULL change below dying half-way through a
        // non-transactional MySQL DDL), and without /u its \s follows the
        // process locale, under which bytes inside "ą" or "à" can count as
        // spaces. Replacing whole byte sequences is exact under any locale and
        // any encoding damage. The non-ASCII spaces are the ones pasted names
        // carry: U+00A0 from web pages, U+202F/U+2009 from French and macOS
        // typography, U+3000 from CJK input.
        //
        // Skipped when `name` is already gone: a run that died after dropping
        // it but before being recorded has nothing left to backfill.
        $rows = Schema::hasColumn('authors', 'name')
            ? DB::table('authors')->orderBy('id')->get(['id', 'name'])
            : [];

        foreach ($rows as $row) {
            $spaced = str_replace(
                ["\t", "\n", "\r", "\v", "\f", "\u{00A0}", "\u{2007}", "\u{2009}", "\u{202F}", "\u{3000}"],
                ' ',
                (string) $row->name,
            );
            $words = array_values(array_filter(explode(' ', $spaced), fn ($w) => $w !== ''));
            $parts = $words === [] ? [] : [$words[0], implode(' ', array_slice($words, 1)) ?: null];

            if ($parts === []) {
                // The API always required a name; only direct SQL leaves one blank.
                Log::warning("authors.{$row->id} had a blank name; first_name set to '?'");
            }

            DB::table('authors')->where('id', $row->id)->update([
                'first_name' => $parts[0] ?? '?',
                'last_name'  => $parts[1] ?? null,
            ]);
        }

        Schema::table('authors', function (Blueprint $table) {
            $table->string('first_name')->nullable(false)->change();
        });

        if (Schema::hasColumn('authors', 'name')) {
            Schema::table('authors', function (Blueprint $table) {
                $table->dropColumn('name');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('authors', 'name')) {
            Schema::table('authors', function (Blueprint $table) {
                $table->string('name')->nullable()->after('id');
            });
        }

        // Two 255-char halves can outgrow the one 255-char column; strict
        // MySQL would reject the update and strand a half-reverted schema.
        foreach (DB::table('authors')->orderBy('id')->get(['id', 'first_name', 'last_name']) as $row) {
            DB::table('authors')->where('id', $row->id)->update([
                'name' => mb_substr(trim("{$row->first_name} {$row->last_name}"), 0, 255),
            ]);
        }

        // NOT NULL, as create_authors_table made it.
        Schema::table('authors', function (Blueprint $table) {
            $table->string('name')->nullable(false)->change();
            $table->dropColumn(['first_name', 'last_name']);
        });
    }
};
