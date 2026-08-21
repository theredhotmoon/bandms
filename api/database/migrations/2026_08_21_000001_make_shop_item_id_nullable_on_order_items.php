<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `order_items` was built for merch, so `shop_item_id` is NOT NULL. When ticket
 * support was added, the ticket columns were made nullable but that one was left
 * as it was — and CheckoutController builds a ticket line with no shop_item_id
 * at all. A cart containing only tickets therefore died on insert with
 * SQLSTATE[HY000] 1364, so no ticket could be bought unless merch was bought too.
 *
 * It stayed hidden because no test posts a ticket checkout, and the ticket tests
 * that do build order items attach a shop item to them — data the application
 * itself never produces.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('order_items', 'shop_item_id')) {
            return;
        }

        // MySQL will not modify a column while a foreign key covers it, so the
        // constraint comes off and goes back on around the change. SQLite (used
        // by the test suite) rebuilds the table and has no named constraint to
        // drop, hence the guard.
        $usesForeignKeys = Schema::getConnection()->getDriverName() !== 'sqlite';

        if ($usesForeignKeys) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->dropForeign(['shop_item_id']);
            });
        }

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('shop_item_id')->nullable()->change();
        });

        if ($usesForeignKeys) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->foreign('shop_item_id')->references('id')->on('shop_items')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Deliberately not reinstating NOT NULL: any ticket-only row written
        // since this ran would make the rollback fail, and reviving the bug is
        // not worth it.
    }
};
