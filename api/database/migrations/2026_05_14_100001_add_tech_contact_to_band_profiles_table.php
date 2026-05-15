<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->string('tech_contact_phone', 50)->nullable()->after('press_email');
            $table->string('tech_contact_email', 255)->nullable()->after('tech_contact_phone');
            $table->text('tech_rider_notes')->nullable()->after('tech_contact_email');
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropColumn(['tech_contact_phone', 'tech_contact_email', 'tech_rider_notes']);
        });
    }
};
