<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('presale_code_tiers', function (Blueprint $table) {
            $table->foreignId('presale_code_id')->constrained('presale_codes')->cascadeOnDelete();
            $table->foreignId('concert_ticket_price_tier_id')->constrained('concert_ticket_price_tiers')->cascadeOnDelete();
            $table->primary(['presale_code_id', 'concert_ticket_price_tier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presale_code_tiers');
    }
};
