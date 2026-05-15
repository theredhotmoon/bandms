<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            $table->string('login_email')->nullable()->unique()->after('calendar_url');
            $table->boolean('can_login')->default(false)->after('login_email');
        });

        Schema::dropIfExists('allowed_emails');
    }

    public function down(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            $table->dropColumn(['login_email', 'can_login']);
        });
    }
};
