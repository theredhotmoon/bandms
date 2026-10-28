<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which presale code let a ticket be bought before its sale opened. The code's
 * used_count is incremented from these rows when Stripe confirms payment, one
 * per ticket — the same moment promo codes are counted — so an abandoned
 * checkout spends no uses and one order of ten tickets spends ten.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('presale_code_id')->nullable()->after('concert_ticket_price_tier_id')
                ->constrained('presale_codes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('presale_code_id');
        });
    }
};
