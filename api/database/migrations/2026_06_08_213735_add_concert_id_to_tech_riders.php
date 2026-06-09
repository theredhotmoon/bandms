<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->foreignId('concert_id')->nullable()->after('public_token')
                  ->constrained('concerts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->dropForeign(['concert_id']);
            $table->dropColumn('concert_id');
        });
    }
};
