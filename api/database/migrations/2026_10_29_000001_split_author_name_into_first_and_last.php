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
        // name, which the band can fix in the form. The two halves rejoin to
        // the original string, which is what down() relies on.
        //
        // No /u on the pattern: with it, a name holding invalid UTF-8 makes
        // preg_split return false, first_name is written NULL and the NOT NULL
        // change below dies half-way through a non-transactional MySQL DDL.
        // Splitting on ASCII whitespace never touches a multibyte sequence.
        foreach (DB::table('authors')->orderBy('id')->get(['id', 'name']) as $row) {
            $name  = trim((string) $row->name);
            $parts = $name === '' ? [] : preg_split('/\s+/', $name, 2);

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
            $table->dropColumn('name');
        });
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
