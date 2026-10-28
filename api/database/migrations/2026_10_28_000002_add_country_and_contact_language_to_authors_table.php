<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('authors', function (Blueprint $table) {
            // ISO 3166-1 alpha-2 / ISO 639-1 codes; the admin renders names.
            $table->char('country', 2)->nullable()->after('phone');
            $table->string('contact_language', 3)->nullable()->after('country');
        });
    }

    public function down(): void
    {
        Schema::table('authors', function (Blueprint $table) {
            $table->dropColumn(['country', 'contact_language']);
        });
    }
};
