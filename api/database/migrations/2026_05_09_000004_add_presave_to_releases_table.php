<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('releases', function (Blueprint $table) {
            $table->boolean('is_upcoming')->default(false)->after('description');
            $table->string('presave_url')->nullable()->after('is_upcoming');
        });
    }

    public function down(): void
    {
        Schema::table('releases', function (Blueprint $table) {
            $table->dropColumn(['is_upcoming', 'presave_url']);
        });
    }
};
