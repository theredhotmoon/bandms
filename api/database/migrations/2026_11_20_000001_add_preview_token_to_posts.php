<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * A secret per post: the public build bakes every draft at
 * /{lang}/post-preview/{token}/, so the band can see an unpublished post as
 * visitors will. The token is the only thing that finds the page — nothing
 * lists or links it — so it is long and random, like a rider token.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('preview_token', 48)->nullable()->unique()->after('slug');
        });

        DB::table('posts')->whereNull('preview_token')->orderBy('id')->pluck('id')
            ->each(fn ($id) => DB::table('posts')->where('id', $id)->update(['preview_token' => Str::random(40)]));
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropUnique(['preview_token']);
            $table->dropColumn('preview_token');
        });
    }
};
