<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_item_category', function (Blueprint $table) {
            $table->foreignId('shop_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_category_id')->constrained()->cascadeOnDelete();
            $table->primary(['shop_item_id', 'shop_category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_item_category');
    }
};
