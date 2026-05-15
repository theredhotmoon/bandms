<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('venues', function (Blueprint $table) {
            $table->dropColumn('address');
            $table->string('street')->nullable()->after('name');
            $table->string('street_number', 20)->nullable()->after('street');
            $table->string('city', 100)->nullable()->after('street_number');
            $table->string('postcode', 20)->nullable()->after('city');
            $table->string('additional_info')->nullable()->after('postcode');
        });
    }

    public function down(): void
    {
        Schema::table('venues', function (Blueprint $table) {
            $table->dropColumn(['street', 'street_number', 'city', 'postcode', 'additional_info']);
            $table->string('address')->nullable()->after('name');
        });
    }
};
