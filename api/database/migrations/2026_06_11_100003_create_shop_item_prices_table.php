<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_item_prices', function (Blueprint $table) {
            $table->foreignId('shop_item_id')->constrained()->cascadeOnDelete();
            $table->char('currency', 3);
            $table->decimal('amount', 10, 2);
            $table->primary(['shop_item_id', 'currency']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_item_prices');
    }
};
