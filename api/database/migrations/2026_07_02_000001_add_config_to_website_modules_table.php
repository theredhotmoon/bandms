<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->text('custom_name')->nullable()->after('display_name');
            $table->unsignedTinyInteger('per_page')->nullable()->after('custom_name');
        });
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn(['custom_name', 'per_page']);
        });
    }
};
