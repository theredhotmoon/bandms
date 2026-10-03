<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * A public page per member, at /{lang}/{about}/{slug}.
 *
 * One plain slug rather than a translated bag: a name does not translate, and
 * the page's URL differs between locales only by its section segment.
 *
 * Existing members are backfilled here, in id order, with the same rule
 * BandMember applies on create — the rule is inlined because migrations re-run
 * on every fresh database and must not change behaviour if the model does.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('last_name');
        });

        $taken = [];
        foreach (DB::table('band_members')->orderBy('id')->get(['id', 'first_name', 'last_name']) as $row) {
            $base = Str::slug(trim("{$row->first_name} {$row->last_name}")) ?: 'member';
            $slug = $base;
            for ($n = 2; isset($taken[$slug]); $n++) {
                $slug = "{$base}-{$n}";
            }
            $taken[$slug] = true;
            DB::table('band_members')->where('id', $row->id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
