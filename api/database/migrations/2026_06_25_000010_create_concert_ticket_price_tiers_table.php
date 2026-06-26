<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concert_ticket_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concert_ticket_type_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('price', 10, 2);
            $table->char('currency', 3)->default('PLN');
            $table->date('available_from')->nullable();
            $table->date('available_until')->nullable();
            $table->unsignedInteger('available_count')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concert_ticket_price_tiers');
    }
};
