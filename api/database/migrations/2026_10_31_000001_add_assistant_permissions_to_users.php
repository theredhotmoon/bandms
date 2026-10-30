<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may spend the assistant's tokens, and who decides.
 *
 * `is_superadmin` manages the two switches (and grants itself to others);
 * superadmins always have both features. Everyone else starts with neither —
 * the band's choice: tokens are spent only after a superadmin enables someone.
 * Every existing admin becomes a superadmin so nobody is locked out on day one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_superadmin')->default(false)->after('role');
            $table->boolean('can_translate')->default(false)->after('is_superadmin');
            $table->boolean('can_enhance')->default(false)->after('can_translate');
        });

        DB::table('users')->where('role', 'admin')->update(['is_superadmin' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_superadmin', 'can_translate', 'can_enhance']);
        });
    }
};
