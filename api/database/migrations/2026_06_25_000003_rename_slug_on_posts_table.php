<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropUnique('posts_slug_unique');
            $table->renameColumn('slug', 'slug_en');
            $table->string('slug_pl')->nullable()->after('slug_en');
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->unique('slug_en');
            $table->unique('slug_pl');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropUnique(['slug_en']);
            $table->dropUnique(['slug_pl']);
            $table->dropColumn('slug_pl');
            $table->renameColumn('slug_en', 'slug');
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->unique('slug');
        });
    }
};
