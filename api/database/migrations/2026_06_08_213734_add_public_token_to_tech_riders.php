<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->string('public_token', 64)->unique()->nullable()->after('is_active');
        });

        \App\Models\TechRider::whereNull('public_token')->each(function ($rider) {
            $rider->timestamps = false;
            $rider->update(['public_token' => Str::random(32)]);
        });
    }

    public function down(): void
    {
        Schema::table('tech_riders', function (Blueprint $table) {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
