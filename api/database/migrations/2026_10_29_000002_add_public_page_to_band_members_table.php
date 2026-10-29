<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            // The member's own opt-out from a public page. Defaults to true so
            // every page that exists today — and every QR code printed for one —
            // keeps working. Only consulted while the About module's
            // member_pages switch is on.
            $table->boolean('public_page')->default(true)->after('slug');
        });
    }

    public function down(): void
    {
        Schema::table('band_members', function (Blueprint $table) {
            $table->dropColumn('public_page');
        });
    }
};
