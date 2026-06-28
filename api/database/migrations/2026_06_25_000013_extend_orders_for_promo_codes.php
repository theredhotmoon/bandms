<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'promo_code_id')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('promo_code_id')
                ->nullable()
                ->after('total')
                ->constrained('promo_codes')
                ->nullOnDelete();
            $table->decimal('discount_amount', 10, 2)
                ->nullable()
                ->default(0)
                ->after('promo_code_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promo_code_id');
            $table->dropColumn('discount_amount');
        });
    }
};
