<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('releases', function (Blueprint $table) {
            $table->string('slug_en')->nullable()->unique()->after('label_name');
            $table->string('slug_pl')->nullable()->unique()->after('slug_en');
        });
    }

    public function down(): void
    {
        Schema::table('releases', function (Blueprint $table) {
            $table->dropUnique(['slug_en']);
            $table->dropUnique(['slug_pl']);
            $table->dropColumn(['slug_en', 'slug_pl']);
        });
    }
};
