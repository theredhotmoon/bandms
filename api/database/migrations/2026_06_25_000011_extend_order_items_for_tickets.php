<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('concert_ticket_type_id')
                ->nullable()
                ->after('shop_item_variant_id')
                ->constrained()
                ->nullOnDelete();
            $table->foreignId('concert_ticket_price_tier_id')
                ->nullable()
                ->after('concert_ticket_type_id')
                ->constrained()
                ->nullOnDelete();
            $table->string('ticket_code', 64)->nullable()->unique()->after('concert_ticket_price_tier_id');
            $table->timestamp('scanned_at')->nullable()->after('ticket_code');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('concert_ticket_price_tier_id');
            $table->dropConstrainedForeignId('concert_ticket_type_id');
        });
    }
};
