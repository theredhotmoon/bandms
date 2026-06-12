<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('shop_item_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('variant_label')->nullable();
            $table->decimal('price', 10, 2);
            $table->char('currency', 3);
            $table->unsignedSmallInteger('quantity');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
