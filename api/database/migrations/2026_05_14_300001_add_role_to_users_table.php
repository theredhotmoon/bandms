<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Possible values: admin, member, publisher
            $table->string('role', 32)->default('admin')->after('email');
            $table->foreignId('band_member_id')->nullable()->after('role')
                ->constrained('band_members')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['band_member_id']);
            $table->dropColumn(['role', 'band_member_id']);
        });
    }
};
