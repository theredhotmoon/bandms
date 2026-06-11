<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('band_profiles')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->enum('type', ['record', 'apparel', 'accessory', 'ticket', 'bundle', 'other'])->default('other');
            $table->text('description')->nullable();
            $table->boolean('is_available')->default(true);
            $table->boolean('is_presale')->default(false);
            $table->date('presale_ships_at')->nullable();
            $table->unsignedInteger('stock_quantity')->nullable();
            $table->string('purchase_url', 1000)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_items');
    }
};
