<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->unsignedInteger('position')->default(0)->after('url');
        });

        // Seed existing rows so their order is stable (insertion order via id).
        DB::statement('UPDATE social_links SET position = id');
    }

    public function down(): void
    {
        Schema::table('social_links', function (Blueprint $table) {
            $table->dropColumn('position');
        });
    }
};
