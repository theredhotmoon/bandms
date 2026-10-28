<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('authors', function (Blueprint $table) {
            // Nullable only until the backfill below has filled it.
            $table->string('first_name')->nullable()->after('id');
            // Optional for good: a contact can be one word ("Radio 357").
            $table->string('last_name')->nullable()->after('first_name');
        });

        // First word is the first name, the rest the last name — right for
        // "Anna Kowalska" and "Jan van der Berg", wrong for a double first
        // name, which the band can fix in the form. Nothing is lost either way:
        // the two halves rejoin to the original string.
        foreach (DB::table('authors')->orderBy('id')->get(['id', 'name']) as $row) {
            $parts = preg_split('/\s+/u', trim((string) $row->name), 2);

            DB::table('authors')->where('id', $row->id)->update([
                'first_name' => $parts[0] !== '' ? $parts[0] : '?',
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
        Schema::table('authors', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
        });

        foreach (DB::table('authors')->orderBy('id')->get(['id', 'first_name', 'last_name']) as $row) {
            DB::table('authors')->where('id', $row->id)->update([
                'name' => trim("{$row->first_name} {$row->last_name}"),
            ]);
        }

        Schema::table('authors', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name']);
        });
    }
};
